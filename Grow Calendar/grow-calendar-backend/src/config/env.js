import dotenv from 'dotenv';
dotenv.config();

export const config = {
  weatherKey: process.env.WEATHER_API_KEY,
  perenualKey: process.env.PERENUAL_API_KEY,
  usdaNassKey: process.env.USDA_NASS_API_KEY,
  port: process.env.PORT || 4000,
};

console.log('Loaded USDA key:', process.env.USDA_NASS_API_KEY ? '✅ present' : '❌ missing');