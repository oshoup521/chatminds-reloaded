# ChatMinds - AI Chatbot with PDF Support

ChatMinds is a modern web application that allows users to chat with an AI assistant powered by Google Gemini. It also supports uploading and chatting with PDF documents.

## Features

- Chat with AI assistant using Google Gemini models
- Upload and view PDF documents
- Chat with AI about the content of uploaded PDFs
- Persistent chat history using SQLite database
- Modern UI with animations
- Responsive design for mobile and desktop
- Real-time streaming responses

## Prerequisites

- Node.js 20.x or higher
- Google Gemini API key

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/chatminds-reloaded.git
   cd chatminds-reloaded
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   PORT=3000
   NODE_ENV=development
   SESSION_SECRET=your_session_secret_here
   ```

## Usage

1. Start the development server:
   ```
   npm run dev
   ```

2. Open your browser and navigate to `http://localhost:3000`

3. Start chatting with the AI assistant or upload a PDF to chat about its content

## Project Structure

```
chatminds-reloaded/
├── data/                  # SQLite database files
├── public/                # Static files
│   ├── css/               # CSS styles
│   ├── js/                # JavaScript files
│   └── index.html         # Main HTML file
├── src/                   # Source code
│   ├── controllers/       # Route controllers
│   ├── models/            # Database models
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── utils/             # Utility functions
│   └── views/             # View templates
├── uploads/               # Uploaded PDF files
├── .env                   # Environment variables
├── package.json           # Project dependencies
├── server.js              # Main server file
└── README.md              # Project documentation
```

## Development

To start the development server with hot reloading:

```
npm run dev
```

## Production

To start the server in production mode:

```
npm start
```

## License

MIT

## Acknowledgements

- [Google Gemini](https://ai.google.dev/) for providing the AI models
- [Express](https://expressjs.com/) for the web server framework
- [SQLite](https://www.sqlite.org/) for the database
- [Socket.IO](https://socket.io/) for real-time communication
- [pdf-parse](https://www.npmjs.com/package/pdf-parse) for PDF parsing 