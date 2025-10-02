import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

async function testGeminiAPI() {
  try {
    console.log('🔍 Testing Gemini API...');
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Test with different model names
    const modelNames = [
      'gemini-2.5-flash',
      'gemini-2.5-pro'
    ];
    
    for (const modelName of modelNames) {
      try {
        console.log(`\n📝 Testing model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        
        const result = await model.generateContent('Say hello in one word.');
        const response = await result.response;
        const text = response.text();
        
        console.log(`✅ Success with ${modelName}: ${text}`);
        break; // Use the first working model
        
      } catch (error) {
        console.log(`❌ Failed with ${modelName}: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('💥 Gemini API test failed:', error);
  }
}

testGeminiAPI();