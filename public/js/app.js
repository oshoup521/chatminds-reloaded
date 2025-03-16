// Initialize socket.io connection
const socket = io();

// DOM Elements
const loadingScreen = document.querySelector('.loading-screen');
const welcomeScreen = document.getElementById('welcomeScreen');
const chatInterface = document.getElementById('chatInterface');
const pdfViewer = document.getElementById('pdfViewer');
const chatMessages = document.getElementById('chatMessages');
const pdfChatMessages = document.getElementById('pdfChatMessages');
const chatForm = document.getElementById('chatForm');
const pdfChatForm = document.getElementById('pdfChatForm');
const messageInput = document.getElementById('messageInput');
const pdfMessageInput = document.getElementById('pdfMessageInput');
const chatHeader = document.getElementById('chatHeader');
const pdfTitle = document.getElementById('pdfTitle');
const pdfFrame = document.getElementById('pdfFrame');
const conversationList = document.getElementById('conversationList');
const pdfList = document.getElementById('pdfList');
const newChatBtn = document.getElementById('newChatBtn');
const welcomeNewChatBtn = document.getElementById('welcomeNewChatBtn');
const uploadPdfBtn = document.getElementById('uploadPdfBtn');
const welcomeUploadPdfBtn = document.getElementById('welcomeUploadPdfBtn');
const uploadPdfModal = document.getElementById('uploadPdfModal');
const closeUploadModalBtn = document.getElementById('closeUploadModalBtn');
const uploadPdfForm = document.getElementById('uploadPdfForm');
const pdfFileInput = document.getElementById('pdfFileInput');
const browseBtn = document.getElementById('browseBtn');
const dropArea = document.getElementById('dropArea');
const selectedFile = document.getElementById('selectedFile');
const submitUploadBtn = document.getElementById('submitUploadBtn');
const closePdfBtn = document.getElementById('closePdfBtn');
const openSidebar = document.getElementById('openSidebar');
const closeSidebar = document.getElementById('closeSidebar');
const sidebar = document.querySelector('.sidebar');
const toastContainer = document.getElementById('toastContainer');

// State
let currentConversationId = null;
let currentPdfId = null;
let conversations = [];
let pdfs = [];
let isStreaming = false;

// Initialize AOS animations
document.addEventListener('DOMContentLoaded', () => {
  AOS.init({
    duration: 800,
    once: true,
    offset: 50
  });
  
  // Hide loading screen after a delay
  setTimeout(() => {
    loadingScreen.classList.add('hidden');
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 500);
  }, 1500);
  
  // Load conversations and PDFs
  loadConversations();
  loadPdfs();
});

// Event Listeners
chatForm.addEventListener('submit', handleChatSubmit);
pdfChatForm.addEventListener('submit', handlePdfChatSubmit);
newChatBtn.addEventListener('click', startNewChat);
welcomeNewChatBtn.addEventListener('click', startNewChat);
uploadPdfBtn.addEventListener('click', openUploadModal);
welcomeUploadPdfBtn.addEventListener('click', openUploadModal);
closeUploadModalBtn.addEventListener('click', closeUploadModal);
browseBtn.addEventListener('click', () => pdfFileInput.click());
pdfFileInput.addEventListener('change', handleFileSelect);
uploadPdfForm.addEventListener('submit', handlePdfUpload);
closePdfBtn.addEventListener('click', closePdfViewer);
openSidebar.addEventListener('click', () => sidebar.classList.add('active'));
closeSidebar.addEventListener('click', () => sidebar.classList.remove('active'));

// Handle drag and drop for PDF upload
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropArea.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
  dropArea.addEventListener(eventName, () => {
    dropArea.classList.add('dragover');
  }, false);
});

['dragleave', 'drop'].forEach(eventName => {
  dropArea.addEventListener(eventName, () => {
    dropArea.classList.remove('dragover');
  }, false);
});

dropArea.addEventListener('drop', (e) => {
  const dt = e.dataTransfer;
  const files = dt.files;
  
  if (files.length > 0) {
    pdfFileInput.files = files;
    handleFileSelect();
  }
}, false);

// Auto-resize textarea and handle key events
[messageInput, pdfMessageInput].forEach(textarea => {
  textarea.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
  });
  
  // Handle Enter and Ctrl+Enter keys
  textarea.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      if (e.ctrlKey) {
        // Ctrl+Enter: Insert a new line
        const start = this.selectionStart;
        const end = this.selectionEnd;
        const value = this.value;
        
        this.value = value.substring(0, start) + '\n' + value.substring(end);
        this.selectionStart = this.selectionEnd = start + 1;
        
        // Trigger resize
        const event = new Event('input', { bubbles: true });
        this.dispatchEvent(event);
      } else {
        // Enter: Submit the form
        e.preventDefault();
        
        const form = this.closest('form');
        if (form) {
          const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
          form.dispatchEvent(submitEvent);
        }
      }
    }
  });
});

// Socket.io event listeners
socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('chat message', (data) => {
  if (data.conversationId === currentConversationId) {
    addMessage(data.message, data.role);
  }
});

// Functions
function startNewChat() {
  currentConversationId = generateUUID();
  
  // Update UI
  welcomeScreen.classList.add('hidden');
  pdfViewer.classList.add('hidden');
  chatInterface.classList.remove('hidden');
  
  // Clear chat messages
  chatMessages.innerHTML = '';
  
  // Update chat header
  chatHeader.innerHTML = `<h2>New Conversation</h2>`;
  
  // Add system message
  addMessage('Hello! How can I help you today?', 'assistant');
  
  // Focus on input
  messageInput.focus();
  
  // Add to conversations list if not already there
  const exists = conversations.some(conv => conv.id === currentConversationId);
  
  if (!exists) {
    const newConversation = {
      id: currentConversationId,
      title: 'New Conversation',
      date: new Date()
    };
    
    conversations.unshift(newConversation);
    updateConversationsList();
  }
}

async function handleChatSubmit(e) {
  e.preventDefault();
  
  const message = messageInput.value.trim();
  
  if (!message || isStreaming) return;
  
  // Add user message to chat
  addMessage(message, 'user');
  
  // Clear input
  messageInput.value = '';
  messageInput.style.height = 'auto';
  
  // Show typing indicator
  showTypingIndicator();
  
  try {
    isStreaming = true;
    
    // Send message to server using SSE for streaming
    const response = await fetch('/api/chat/message/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        conversationId: currentConversationId
      })
    });
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let assistantMessage = '';
    
    // Create message element for streaming
    const messageElement = createMessageElement('', 'assistant');
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    const messageContent = messageElement.querySelector('.message-content');
    
    // Remove typing indicator
    removeTypingIndicator();
    
    // Process the stream
    while (true) {
      const { value, done } = await reader.read();
      
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n\n');
      
      for (const line of lines) {
        if (line.startsWith('data:')) {
          try {
            const data = JSON.parse(line.substring(5));
            
            if (data.chunk) {
              assistantMessage += data.chunk;
              messageContent.innerHTML = marked.parse(assistantMessage);
              
              // Highlight code blocks
              messageContent.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
              });
              
              chatMessages.scrollTop = chatMessages.scrollHeight;
            }
            
            if (data.done) {
              // Update conversation title if it's the first message
              if (conversations[0].title === 'New Conversation') {
                conversations[0].title = message.substring(0, 30) + (message.length > 30 ? '...' : '');
                updateConversationsList();
              }
            }
          } catch (error) {
            console.error('Error parsing SSE data:', error);
          }
        }
      }
    }
    
    isStreaming = false;
  } catch (error) {
    console.error('Error sending message:', error);
    removeTypingIndicator();
    isStreaming = false;
    showToast('Error', 'Failed to send message. Please try again.', 'error');
  }
}

async function handlePdfChatSubmit(e) {
  e.preventDefault();
  
  const message = pdfMessageInput.value.trim();
  
  if (!message || !currentPdfId || isStreaming) return;
  
  // Add user message to chat
  addPdfMessage(message, 'user');
  
  // Clear input
  pdfMessageInput.value = '';
  pdfMessageInput.style.height = 'auto';
  
  // Show typing indicator
  showPdfTypingIndicator();
  
  try {
    isStreaming = true;
    
    // Send message to server
    const response = await fetch(`/api/pdf/${currentPdfId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Add assistant message to chat
      addPdfMessage(data.message, 'assistant');
    } else {
      throw new Error(data.error || 'Failed to get response');
    }
    
    isStreaming = false;
  } catch (error) {
    console.error('Error sending message to PDF chat:', error);
    isStreaming = false;
    showToast('Error', 'Failed to send message. Please try again.', 'error');
  }
  
  // Remove typing indicator
  removePdfTypingIndicator();
}

function addMessage(content, role) {
  const messageElement = createMessageElement(content, role);
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addPdfMessage(content, role) {
  const messageElement = createMessageElement(content, role);
  pdfChatMessages.appendChild(messageElement);
  pdfChatMessages.scrollTop = pdfChatMessages.scrollHeight;
}

function createMessageElement(content, role) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;
  
  const avatarDiv = document.createElement('div');
  avatarDiv.className = `message-avatar ${role}`;
  
  if (role === 'user') {
    avatarDiv.innerHTML = '<i class="fas fa-user"></i>';
  } else {
    avatarDiv.innerHTML = '<i class="fas fa-robot"></i>';
  }
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.innerHTML = content ? marked.parse(content) : '';
  
  // Highlight code blocks
  if (content) {
    setTimeout(() => {
      contentDiv.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
      });
    }, 0);
  }
  
  const timestampDiv = document.createElement('div');
  timestampDiv.className = 'message-timestamp';
  timestampDiv.textContent = new Date().toLocaleTimeString();
  
  contentDiv.appendChild(timestampDiv);
  messageDiv.appendChild(avatarDiv);
  messageDiv.appendChild(contentDiv);
  
  return messageDiv;
}

function showTypingIndicator() {
  const typingDiv = document.createElement('div');
  typingDiv.className = 'message assistant typing-message';
  typingDiv.id = 'typingIndicator';
  
  const avatarDiv = document.createElement('div');
  avatarDiv.className = 'message-avatar assistant';
  avatarDiv.innerHTML = '<i class="fas fa-robot"></i>';
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  
  const typingIndicator = document.createElement('div');
  typingIndicator.className = 'typing-indicator';
  typingIndicator.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  
  contentDiv.appendChild(typingIndicator);
  typingDiv.appendChild(avatarDiv);
  typingDiv.appendChild(contentDiv);
  
  chatMessages.appendChild(typingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showPdfTypingIndicator() {
  const typingDiv = document.createElement('div');
  typingDiv.className = 'message assistant typing-message';
  typingDiv.id = 'pdfTypingIndicator';
  
  const avatarDiv = document.createElement('div');
  avatarDiv.className = 'message-avatar assistant';
  avatarDiv.innerHTML = '<i class="fas fa-robot"></i>';
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  
  const typingIndicator = document.createElement('div');
  typingIndicator.className = 'typing-indicator';
  typingIndicator.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  
  contentDiv.appendChild(typingIndicator);
  typingDiv.appendChild(avatarDiv);
  typingDiv.appendChild(contentDiv);
  
  pdfChatMessages.appendChild(typingDiv);
  pdfChatMessages.scrollTop = pdfChatMessages.scrollHeight;
}

function removeTypingIndicator() {
  const typingIndicator = document.getElementById('typingIndicator');
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

function removePdfTypingIndicator() {
  const typingIndicator = document.getElementById('pdfTypingIndicator');
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

async function loadConversations() {
  try {
    const response = await fetch('/api/chat/history');
    const data = await response.json();
    
    if (data.success) {
      // Group messages by conversation ID
      const groupedMessages = {};
      
      data.history.forEach(msg => {
        if (!msg.conversation_id) return; // Skip messages without conversation ID
        
        if (!groupedMessages[msg.conversation_id]) {
          groupedMessages[msg.conversation_id] = [];
        }
        
        groupedMessages[msg.conversation_id].push(msg);
      });
      
      // Create conversation objects
      conversations = Object.keys(groupedMessages).map(id => {
        const messages = groupedMessages[id];
        const firstUserMessage = messages.find(msg => msg.role === 'user');
        
        return {
          id,
          title: firstUserMessage ? 
            (firstUserMessage.content.substring(0, 30) + (firstUserMessage.content.length > 30 ? '...' : '')) : 
            'New Conversation',
          date: new Date(messages[0].timestamp || Date.now()),
          messageCount: messages.length
        };
      });
      
      // Sort by date (newest first)
      conversations.sort((a, b) => b.date - a.date);
      
      updateConversationsList();
    }
  } catch (error) {
    console.error('Error loading conversations:', error);
    showToast('Error', 'Failed to load conversations', 'error');
  }
}

async function loadPdfs() {
  try {
    const response = await fetch('/api/pdf/list');
    const data = await response.json();
    
    if (data.success) {
      pdfs = data.pdfs;
      updatePdfsList();
    }
  } catch (error) {
    console.error('Error loading PDFs:', error);
  }
}

function updateConversationsList() {
  conversationList.innerHTML = '';
  
  if (conversations.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-list';
    emptyDiv.textContent = 'No conversations yet';
    conversationList.appendChild(emptyDiv);
    return;
  }
  
  conversations.forEach(conv => {
    const item = document.createElement('div');
    item.className = `conversation-item ${conv.id === currentConversationId ? 'active' : ''}`;
    item.dataset.id = conv.id;
    
    // Format the title - make sure it's not empty
    const title = conv.title || 'New Conversation';
    const displayTitle = title.length > 30 ? title.substring(0, 30) + '...' : title;
    
    item.innerHTML = `
      <div class="conversation-icon">
        <i class="fas fa-comment"></i>
      </div>
      <div class="conversation-info">
        <div class="conversation-title">${displayTitle}</div>
        <div class="conversation-date">${formatDate(conv.date)}</div>
      </div>
      <button class="delete-btn" title="Delete conversation">
        <i class="fas fa-trash"></i>
      </button>
    `;
    
    item.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteConversation(conv.id);
    });
    
    item.addEventListener('click', () => loadConversation(conv.id));
    
    conversationList.appendChild(item);
  });
}

function updatePdfsList() {
  pdfList.innerHTML = '';
  
  if (pdfs.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-list';
    emptyDiv.textContent = 'No PDFs uploaded';
    pdfList.appendChild(emptyDiv);
    return;
  }
  
  pdfs.forEach(pdf => {
    const item = document.createElement('div');
    item.className = `pdf-item ${pdf.id === currentPdfId ? 'active' : ''}`;
    item.dataset.id = pdf.id;
    
    item.innerHTML = `
      <div class="pdf-icon">
        <i class="fas fa-file-pdf"></i>
      </div>
      <div class="pdf-info">
        <div class="pdf-title">${pdf.title || pdf.filename}</div>
        <div class="pdf-date">${formatDate(new Date(pdf.uploadDate))}</div>
      </div>
      <button class="delete-btn" title="Delete PDF">
        <i class="fas fa-trash"></i>
      </button>
    `;
    
    item.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deletePdf(pdf.id);
    });
    
    item.addEventListener('click', () => openPdf(pdf.id));
    
    pdfList.appendChild(item);
  });
}

async function loadConversation(conversationId) {
  try {
    currentConversationId = conversationId;
    
    // Update UI
    welcomeScreen.classList.add('hidden');
    pdfViewer.classList.add('hidden');
    chatInterface.classList.remove('hidden');
    
    // Update active state in sidebar
    document.querySelectorAll('.conversation-item').forEach(item => {
      item.classList.toggle('active', item.dataset.id === conversationId);
    });
    
    // Find conversation
    const conversation = conversations.find(conv => conv.id === conversationId);
    
    if (conversation) {
      // Update chat header
      chatHeader.innerHTML = `<h2>${conversation.title}</h2>`;
      
      // Clear chat messages
      chatMessages.innerHTML = '';
      
      // Load messages from server
      const response = await fetch(`/api/chat/history?conversationId=${conversationId}`);
      const data = await response.json();
      
      if (data.success) {
        // Add messages to chat
        if (data.history && data.history.length > 0) {
          data.history.forEach(msg => {
            addMessage(msg.content, msg.role);
          });
        }
      }
    }
    
    // Close sidebar on mobile
    sidebar.classList.remove('active');
    
    // Focus on input
    messageInput.focus();
  } catch (error) {
    console.error('Error loading conversation:', error);
    showToast('Error', 'Failed to load conversation', 'error');
  }
}

async function openPdf(pdfId) {
  try {
    currentPdfId = pdfId;
    
    // Update UI
    welcomeScreen.classList.add('hidden');
    chatInterface.classList.add('hidden');
    pdfViewer.classList.remove('hidden');
    
    // Update active state in sidebar
    document.querySelectorAll('.pdf-item').forEach(item => {
      item.classList.toggle('active', item.dataset.id === pdfId);
    });
    
    // Get PDF info
    const response = await fetch(`/api/pdf/${pdfId}`);
    const data = await response.json();
    
    if (data.success) {
      const pdf = data.pdf;
      
      // Update PDF viewer
      pdfTitle.textContent = pdf.title || pdf.filename;
      pdfFrame.src = `/${pdf.filepath}#toolbar=0&navpanes=0&scrollbar=0&statusbar=0&view=FitH`;
      
      // Load chat history
      const chatResponse = await fetch(`/api/pdf/${pdfId}/chat`);
      const chatData = await chatResponse.json();
      
      if (chatData.success) {
        // Clear chat messages
        pdfChatMessages.innerHTML = '';
        
        // Add messages to chat
        if (chatData.history && chatData.history.length > 0) {
          chatData.history.forEach(msg => {
            addPdfMessage(msg.content, msg.role);
          });
        } else {
          // Add welcome message
          addPdfMessage('Hello! Ask me any questions about this PDF.', 'assistant');
        }
      }
    }
    
    // Close sidebar on mobile
    sidebar.classList.remove('active');
    
    // Focus on input
    pdfMessageInput.focus();
  } catch (error) {
    console.error('Error opening PDF:', error);
    showToast('Error', 'Failed to open PDF', 'error');
  }
}

function openUploadModal() {
  uploadPdfModal.classList.add('active');
  
  // Reset form
  uploadPdfForm.reset();
  selectedFile.innerHTML = '<p>No file selected</p>';
  submitUploadBtn.disabled = true;
}

function closeUploadModal() {
  uploadPdfModal.classList.remove('active');
}

function handleFileSelect() {
  const file = pdfFileInput.files[0];
  
  if (file) {
    if (file.type !== 'application/pdf') {
      showToast('Error', 'Please select a PDF file', 'error');
      pdfFileInput.value = '';
      selectedFile.innerHTML = '<p>No file selected</p>';
      submitUploadBtn.disabled = true;
      return;
    }
    
    selectedFile.innerHTML = `
      <p><i class="fas fa-file-pdf"></i> ${file.name} (${formatFileSize(file.size)})</p>
    `;
    
    submitUploadBtn.disabled = false;
  } else {
    selectedFile.innerHTML = '<p>No file selected</p>';
    submitUploadBtn.disabled = true;
  }
}

async function handlePdfUpload(e) {
  e.preventDefault();
  
  const file = pdfFileInput.files[0];
  
  if (!file) return;
  
  try {
    // Create form data
    const formData = new FormData();
    formData.append('pdf', file);
    
    // Show loading toast
    showToast('Uploading', 'Uploading PDF file...', 'info');
    
    // Upload file
    const response = await fetch('/api/pdf/upload', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Add PDF to list
      pdfs.unshift(data.pdf);
      updatePdfsList();
      
      // Close modal
      closeUploadModal();
      
      // Open PDF
      openPdf(data.pdf.id);
      
      // Show success toast
      showToast('Success', 'PDF uploaded successfully', 'success');
    } else {
      throw new Error(data.error || 'Failed to upload PDF');
    }
  } catch (error) {
    console.error('Error uploading PDF:', error);
    showToast('Error', 'Failed to upload PDF', 'error');
  }
}

function closePdfViewer() {
  // If we have a conversation, go back to it
  if (currentConversationId) {
    loadConversation(currentConversationId);
  } else {
    // Otherwise show welcome screen
    welcomeScreen.classList.remove('hidden');
    pdfViewer.classList.add('hidden');
  }
  
  currentPdfId = null;
  
  // Update active state in sidebar
  document.querySelectorAll('.pdf-item').forEach(item => {
    item.classList.remove('active');
  });
}

function showToast(title, message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  toast.innerHTML = `
    <div class="toast-icon ${type}">
      <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
    </div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;
  
  toastContainer.appendChild(toast);
  
  // Remove toast after 3 seconds
  setTimeout(() => {
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 3000);
}

// Helper Functions
function formatDate(date) {
  const now = new Date();
  const diff = now - date;
  
  // Less than a day
  if (diff < 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // Less than a week
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  }
  
  // Otherwise show date
  return date.toLocaleDateString();
}

function formatFileSize(bytes) {
  if (bytes < 1024) {
    return bytes + ' B';
  } else if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + ' KB';
  } else {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function deleteConversation(conversationId) {
  if (!confirm('Are you sure you want to delete this conversation?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/chat/conversation/${conversationId}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Remove from conversations array
      conversations = conversations.filter(conv => conv.id !== conversationId);
      
      // Update UI
      updateConversationsList();
      
      // If current conversation was deleted, show welcome screen
      if (currentConversationId === conversationId) {
        currentConversationId = null;
        welcomeScreen.classList.remove('hidden');
        chatInterface.classList.add('hidden');
      }
      
      showToast('Success', 'Conversation deleted', 'success');
    } else {
      throw new Error(data.error || 'Failed to delete conversation');
    }
  } catch (error) {
    console.error('Error deleting conversation:', error);
    showToast('Error', 'Failed to delete conversation', 'error');
  }
}

async function deletePdf(pdfId) {
  if (!confirm('Are you sure you want to delete this PDF?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/pdf/${pdfId}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Remove from pdfs array
      pdfs = pdfs.filter(pdf => pdf.id !== pdfId);
      
      // Update UI
      updatePdfsList();
      
      // If current PDF was deleted, show welcome screen
      if (currentPdfId === pdfId) {
        currentPdfId = null;
        welcomeScreen.classList.remove('hidden');
        pdfViewer.classList.add('hidden');
      }
      
      showToast('Success', 'PDF deleted', 'success');
    } else {
      throw new Error(data.error || 'Failed to delete PDF');
    }
  } catch (error) {
    console.error('Error deleting PDF:', error);
    showToast('Error', 'Failed to delete PDF', 'error');
  }
} 