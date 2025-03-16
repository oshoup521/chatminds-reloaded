const { OpenAI } = require('openai');
const dotenv = require('dotenv');

dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Generate chat completion
async function generateChatCompletion(messages) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
      stream: false
    });

    return completion.choices[0].message;
  } catch (error) {
    console.error('Error generating chat completion:', error);
    throw error;
  }
}

// Generate streaming chat completion
async function generateStreamingChatCompletion(messages, onChunk) {
  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
      stream: true
    });

    let fullResponse = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullResponse += content;
      
      if (onChunk && content) {
        onChunk(content);
      }
    }

    return { role: 'assistant', content: fullResponse };
  } catch (error) {
    console.error('Error generating streaming chat completion:', error);
    throw error;
  }
}

// Generate embeddings for text
async function generateEmbeddings(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw error;
  }
}

// Chat with PDF content
async function chatWithPdf(pdfContent, userQuestion, chatHistory = []) {
  try {
    // Prepare messages with PDF content and chat history
    const messages = [
      {
        role: 'system',
        content: `You are a helpful assistant that answers questions based on the provided PDF content. 
                  Use the following PDF content to answer the user's questions:
                  
                  ${pdfContent.substring(0, 15000)}` // Limit content to avoid token limits
      }
    ];

    // Add chat history
    messages.push(...chatHistory);

    // Add user question
    messages.push({
      role: 'user',
      content: userQuestion
    });

    // Generate response
    return await generateChatCompletion(messages);
  } catch (error) {
    console.error('Error chatting with PDF:', error);
    throw error;
  }
}

module.exports = {
  generateChatCompletion,
  generateStreamingChatCompletion,
  generateEmbeddings,
  chatWithPdf
}; 