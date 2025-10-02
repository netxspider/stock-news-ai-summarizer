import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

async function listModels() {
  try {
    console.log('🔍 Listing available Gemini models...');
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    const models = await genAI.listModels();
    console.log('Available models:');
    models.forEach((model, index) => {
      console.log(`${index + 1}. ${model.name} - ${model.displayName}`);
    });
    
  } catch (error) {
    console.error('💥 Error listing models:', error.message);
    console.log('\n🔑 API Key check:');
    console.log(`API Key exists: ${!!process.env.GEMINI_API_KEY}`);
    console.log(`API Key length: ${process.env.GEMINI_API_KEY?.length || 0}`);
    console.log(`API Key preview: ${process.env.GEMINI_API_KEY?.substring(0, 10)}...`);
  }
}

listModels();