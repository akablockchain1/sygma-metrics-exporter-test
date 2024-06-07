import Web3 from 'web3';
import express from 'express';
import client from 'prom-client';
import fs from 'fs';
import path from 'path';

const infuraUrl = process.env.INFURA_URL;
const tokenContractAddress = process.env.TOKEN_CONTRACT_ADDRESS;

const web3 = new Web3(new Web3.providers.HttpProvider(infuraUrl));

const tokenABI = [
  {
    "constant": true,
    "inputs": [
      {
        "name": "_owner",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "name": "balance",
        "type": "uint256"
      }
    ],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "_to",
        "type": "address"
      },
      {
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "transfer",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "type": "function"
  }
];

const tokenContract = new web3.eth.Contract(tokenABI, tokenContractAddress);

const app = express();
const register = client.register;

let totalGasUsedValue = BigInt(0);
let transactionFailuresValue = 0;
let contractInteractionsValue = 0;

const totalGasUsed = new client.Counter({
  name: 'total_gas_used',
  help: 'Total gas usage of transactions'
});

const transactionFailures = new client.Counter({
  name: 'transaction_failures',
  help: 'Number of transaction failures'
});

const contractInteractions = new client.Counter({
  name: 'contract_interactions',
  help: 'Number of interactions with the contract'
});

const METRICS_FILE = path.join('/data', 'metrics.json');

const saveMetrics = (lastBlock) => {
  const metricsData = {
    totalGasUsed: totalGasUsedValue.toString(),
    transactionFailures: transactionFailuresValue,
    contractInteractions: contractInteractionsValue,
    lastBlock: lastBlock.toString()
  };
  fs.writeFileSync(METRICS_FILE, JSON.stringify(metricsData, null, 2));
  console.log('Metrics saved:', metricsData);
};

const loadMetrics = () => {
  if (fs.existsSync(METRICS_FILE)) {
    const metricsData = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'));
    totalGasUsedValue = BigInt(metricsData.totalGasUsed);
    transactionFailuresValue = metricsData.transactionFailures;
    contractInteractionsValue = metricsData.contractInteractions;
    const lastBlock = BigInt(metricsData.lastBlock); // Преобразование строки обратно в BigInt
    console.log('Metrics loaded:', metricsData);
    return lastBlock;
  }
  return BigInt(0);
};

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

const getMetrics = async () => {
  try {
    const lastBlock = loadMetrics();
    const latestBlock = BigInt(await web3.eth.getBlockNumber());

    if (lastBlock >= latestBlock) {
      console.log('No new blocks to process');
      return;
    }

    const events = await tokenContract.getPastEvents('allEvents', {
      fromBlock: lastBlock + 1n,
      toBlock: latestBlock
    });

    let newGasUsed = BigInt(0);
    let newTransactionFailures = 0;
    let newContractInteractions = 0;

    for (const event of events) {
      newContractInteractions += 1;

      const receipt = await web3.eth.getTransactionReceipt(event.transactionHash);
      if (receipt) {
        newGasUsed += BigInt(receipt.gasUsed);
        if (!receipt.status) {
          newTransactionFailures += 1;
        }
      }
    }

    totalGasUsedValue += newGasUsed;
    transactionFailuresValue += newTransactionFailures;
    contractInteractionsValue += newContractInteractions;

    totalGasUsed.inc(Number(newGasUsed));
    transactionFailures.inc(newTransactionFailures);
    contractInteractions.inc(newContractInteractions);

    saveMetrics(latestBlock);
  } catch (error) {
    console.error('Error fetching metrics:', error);
  }
};

setInterval(getMetrics, 10000);

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
