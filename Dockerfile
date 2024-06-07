# Этап сборки
FROM node:20 AS builder

# Создаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходный код
COPY . .

# Этап производства
FROM node:20 AS production

# Создаем рабочую директорию
WORKDIR /app

# Копируем только необходимые файлы из этапа сборки
COPY --from=builder /app /app

# Устанавливаем только production-зависимости
RUN npm ci --only=production

# Экспортируем порт
EXPOSE 3000

# Определяем команду для запуска приложения
CMD ["node", "exporter.js"]
