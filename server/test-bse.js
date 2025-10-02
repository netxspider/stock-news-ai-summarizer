import { NewsCollector } from './services/newsCollector.js';

console.log('Testing news collection for BSE...');

const newsCollector = new NewsCollector();

async function testBSE() {
  try {
    console.log('🔍 Starting BSE news collection...');
    const news = await newsCollector.collectNews('BSE');
    console.log(`📰 BSE news results: ${news.length} articles found`);
    
    if (news.length > 0) {
      console.log('Sample articles:');
      news.slice(0, 3).forEach((article, i) => {
        console.log(`${i + 1}. ${article.title} (${article.source})`);
      });
    } else {
      console.log('❌ No articles found for BSE');
    }
  } catch (error) {
    console.error('❌ Error collecting BSE news:', error);
  }
}

testBSE();