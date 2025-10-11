import dotenv from 'dotenv';
dotenv.config();

export const config = {
  openaiKey: process.env.OPENAI_API_KEY,
  weatherKey: process.env.WEATHER_API_KEY,
  soilKey: process.env.SOIL_API_KEY,
  port: process.env.PORT || 4000,
};