const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Gemini API client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Get the correct model name based on the SDK version
const MODEL_NAME = 'gemini-2.0-flash'; // Using the widely available model

// Generate chat completion
async function generateChatCompletion(messages) {
  try {
    // Convert OpenAI format messages to Gemini format
    const geminiMessages = convertToGeminiFormat(messages);
    
    // Get the model
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    
    // Start a chat session
    const chat = model.startChat({
      history: geminiMessages.slice(0, -1), // All messages except the last one
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000,
      },
    });
    
    // Generate response for the last message
    const lastMessage = geminiMessages[geminiMessages.length - 1];
    const result = await chat.sendMessage(lastMessage.parts[0].text);
    const response = result.response;
    
    return { role: 'assistant', content: response.text() };
  } catch (error) {
    console.error('Error generating chat completion:', error);
    throw error;
  }
}

// Generate streaming chat completion
async function generateStreamingChatCompletion(messages, onChunk) {
  try {
    // Convert OpenAI format messages to Gemini format
    const geminiMessages = convertToGeminiFormat(messages);
    
    // Get the model
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    
    // Start a chat session
    const chat = model.startChat({
      history: geminiMessages.slice(0, -1), // All messages except the last one
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000,
      },
    });
    
    // Generate streaming response for the last message
    const lastMessage = geminiMessages[geminiMessages.length - 1];
    const result = await chat.sendMessageStream(lastMessage.parts[0].text);
    
    let fullResponse = '';
    
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullResponse += chunkText;
      
      if (onChunk && chunkText) {
        onChunk(chunkText);
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
    // Since Gemini doesn't have a direct embedding API in the same way as OpenAI,
    // we'll use the model to generate a representation and then create a simple embedding
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    
    // Generate a summary of the text that can be used for similarity
    const result = await model.generateContent(`Summarize this text in 100 words: ${text}`);
    const summary = result.response.text();
    
    // Create a simple hash-based embedding (this is a fallback approach)
    // In a production environment, you would use a proper embedding service
    const simpleHash = summary.split(' ').reduce((acc, word, i) => {
      const hash = word.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0xFFFFFFFF, 0);
      acc[i % 512] = (acc[i % 512] || 0) + hash;
      return acc;
    }, new Array(512).fill(0));
    
    // Normalize the values
    const magnitude = Math.sqrt(simpleHash.reduce((sum, val) => sum + val * val, 0));
    return simpleHash.map(val => val / (magnitude || 1));
  } catch (error) {
    console.error('Error generating embeddings:', error);
    // Return a fallback empty embedding if the API fails
    return new Array(512).fill(0);
  }
}

// Chat with PDF content
async function chatWithPdf(pdfContent, userQuestion, chatHistory = []) {
  try {
    // Prepare messages with PDF content and chat history
    const systemMessage = {
      role: 'system',
      content: `You are a helpful assistant that answers questions based on the provided PDF content. 
                Use the following PDF content to answer the user's questions:
                
                ${pdfContent.substring(0, 15000)}` // Limit content to avoid token limits
    };
    
    // Convert chat history to Gemini format
    const messages = [systemMessage, ...chatHistory, { role: 'user', content: userQuestion }];
    
    // Generate response
    return await generateChatCompletion(messages);
  } catch (error) {
    console.error('Error chatting with PDF:', error);
    throw error;
  }
}

// Helper function to convert OpenAI format messages to Gemini format
function convertToGeminiFormat(messages) {
  return messages.map(msg => {
    // Map OpenAI roles to Gemini roles
    const role = msg.role === 'assistant' ? 'model' : msg.role === 'system' ? 'user' : 'user';
    
    // For system messages, prepend "SYSTEM: " to differentiate them
    const content = msg.role === 'system' ? `SYSTEM: ${msg.content}` : msg.content;
    
    return {
      role,
      parts: [{ text: content }]
    };
  });
}

module.exports = {
  generateChatCompletion,
  generateStreamingChatCompletion,
  generateEmbeddings,
  chatWithPdf
}; 