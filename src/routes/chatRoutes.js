const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getOrCreateUser, saveChatMessage, getChatHistory, deleteChatConversation } = require('../models/database');
const { generateChatCompletion, generateStreamingChatCompletion } = require('../services/geminiService');

// Get chat history
router.get('/history', async (req, res) => {
  try {
    const sessionId = req.session.id;
    const conversationId = req.query.conversationId;
    
    const user = await getOrCreateUser(sessionId);
    const history = await getChatHistory(user.id, conversationId);
    
    res.json({ success: true, history });
  } catch (error) {
    console.error('Error getting chat history:', error);
    res.status(500).json({ success: false, error: 'Failed to get chat history' });
  }
});

// Send message to chatbot
router.post('/message', async (req, res) => {
  try {
    const { message, conversationId = uuidv4() } = req.body;
    const sessionId = req.session.id;
    
    // Get or create user
    const user = await getOrCreateUser(sessionId);
    
    // Save user message
    await saveChatMessage(user.id, 'user', message, conversationId);
    
    // Get chat history for context
    const history = await getChatHistory(user.id, conversationId);
    
    // Format messages for Gemini
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      ...history.map(msg => ({ role: msg.role, content: msg.content }))
    ];
    
    // Generate response
    const response = await generateChatCompletion(messages);
    
    // Save assistant response
    await saveChatMessage(user.id, 'assistant', response.content, conversationId);
    
    res.json({
      success: true,
      message: response.content,
      conversationId
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, error: 'Failed to process message' });
  }
});

// Stream message to chatbot
router.post('/message/stream', async (req, res) => {
  try {
    const { message, conversationId = uuidv4() } = req.body;
    const sessionId = req.session.id;
    
    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Get or create user
    const user = await getOrCreateUser(sessionId);
    
    // Save user message
    await saveChatMessage(user.id, 'user', message, conversationId);
    
    // Get chat history for context
    const history = await getChatHistory(user.id, conversationId);
    
    // Format messages for Gemini
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      ...history.map(msg => ({ role: msg.role, content: msg.content }))
    ];
    
    let fullResponse = '';
    
    // Generate streaming response
    await generateStreamingChatCompletion(messages, (chunk) => {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      fullResponse += chunk;
    });
    
    // Save assistant response
    await saveChatMessage(user.id, 'assistant', fullResponse, conversationId);
    
    // End the stream
    res.write(`data: ${JSON.stringify({ done: true, conversationId })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Error streaming message:', error);
    res.write(`data: ${JSON.stringify({ error: 'Failed to process message' })}\n\n`);
    res.end();
  }
});

// Delete conversation
router.delete('/conversation/:id', async (req, res) => {
  try {
    const conversationId = req.params.id;
    const sessionId = req.session.id;
    
    // Get user
    const user = await getOrCreateUser(sessionId);
    
    // Delete conversation
    await deleteChatConversation(user.id, conversationId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ success: false, error: 'Failed to delete conversation' });
  }
});

module.exports = router; 