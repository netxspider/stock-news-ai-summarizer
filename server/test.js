import { NewsCollector } from './services/newsCollector.js';
import { AIProcessor } from './services/aiProcessor.js';
import { MockAIProcessor } from './services/mockAIProcessor.js';
import dotenv from 'dotenv';

dotenv.config();

async function testNewsCollection() {
  console.log('🚀 Testing News Collection System...\n');
  
  const newsCollector = new NewsCollector();
  // Use real AI processor if environment variable is set, otherwise use mock
  const aiProcessor = process.env.USE_REAL_AI === 'true' ? new AIProcessor() : new MockAIProcessor();
  
  const testTicker = 'AAPL';
  
  try {
    console.log(`📊 Collecting news for ${testTicker}...`);
    const startTime = Date.now();
    
    // Test news collection
    const newsData = await newsCollector.collectNews(testTicker);
    const collectionTime = Date.now() - startTime;
    
    console.log(`✅ Collection completed in ${collectionTime}ms`);
    console.log(`📰 Found ${newsData.length} articles from all sources\n`);
    
    // Display source breakdown
    const sourceBreakdown = {};
    newsData.forEach(article => {
      sourceBreakdown[article.source] = (sourceBreakdown[article.source] || 0) + 1;
    });
    
    console.log('📈 Source Breakdown:');
    Object.entries(sourceBreakdown).forEach(([source, count]) => {
      console.log(`  ${source}: ${count} articles`);
    });
    console.log();
    
    // Test article selection if we have articles
    if (newsData.length > 0) {
      console.log('🤖 Testing AI article selection...');
      const selectionStart = Date.now();
      
      const selectedArticles = await aiProcessor.selectTopArticles(newsData);
      const selectionTime = Date.now() - selectionStart;
      
      console.log(`✅ Selection completed in ${selectionTime}ms`);
      console.log(`🎯 Selected ${selectedArticles.length} articles\n`);
      
      console.log('📋 Selected Articles:');
      selectedArticles.forEach((article, index) => {
        console.log(`  ${index + 1}. [${article.source}] ${article.title.substring(0, 80)}...`);
      });
      console.log();
      
      // Test summary generation
      console.log('📝 Testing AI summary generation...');
      const summaryStart = Date.now();
      
      const summary = await aiProcessor.generateSummary(selectedArticles);
      const summaryTime = Date.now() - summaryStart;
      
      console.log(`✅ Summary completed in ${summaryTime}ms\n`);
      
      console.log('📊 Generated Summary:');
      console.log(`  Sentiment: ${summary.sentiment}`);
      console.log(`  Market Impact: ${summary.marketImpact}`);
      console.log(`  Key Points: ${summary.keyPoints?.length || 0} items`);
      console.log(`  Summary Length: ${summary.summary?.length || 0} characters\n`);
      
      if (summary.summary) {
        console.log('💡 Summary Preview:');
        console.log(`  ${summary.summary.substring(0, 200)}...`);
        console.log();
      }
      
      if (summary.whatChangedToday) {
        console.log('🔄 What Changed Today:');
        console.log(`  ${summary.whatChangedToday.substring(0, 200)}...`);
        console.log();
      }
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`🎉 Test completed successfully in ${totalTime}ms`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testNewsCollection().then(() => {
  console.log('\n✨ Test script finished');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Test script failed:', error);
  process.exit(1);
});