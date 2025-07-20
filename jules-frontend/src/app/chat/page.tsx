"use client";
import { useState, useRef, useEffect } from "react";
import { chat } from "@/lib/api";
import Image from "next/image";
import { jwtDecode } from 'jwt-decode';
import Link from 'next/link';

interface Message {
  id: string;
  text?: string;
  sender: "user" | "jules";
  timestamp: Date;
  type?: "text" | "images" | "products";
  images?: string[];
  products?: { title?: string; link?: string; image?: string; price?: string; description?: string }[];
}

function getUserIdFromToken() {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded: unknown = jwtDecode(token);
        if (decoded && typeof decoded === 'object' && 'userId' in decoded) {
          return (decoded as { userId: string }).userId;
        }
      } catch { return null; }
    }
  }
  return null;
}

function getUserInitialFromToken() {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded: unknown = jwtDecode(token);
        if (decoded && typeof decoded === 'object' && 'email' in decoded) {
          const email = (decoded as { email: string }).email;
          // Extract name from email (before the @ symbol)
          const name = email.split('@')[0];
          // Get first character and capitalize it
          return name.charAt(0).toUpperCase();
        }
      } catch { return 'U'; }
    }
  }
  return 'U';
}

function safeString(val?: string): string {
  return typeof val === 'string' && val.trim() !== '' ? val : '';
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize messages after component mounts to avoid hydration issues
  useEffect(() => {
    if (!isInitialized) {
      setMessages([
        {
          id: "1",
          text: "Hi! Good to meet you. Before we get started, tell me about yourself.",
          sender: "jules",
          timestamp: new Date(),
        },
      ]);
      setIsInitialized(true);
    }
  }, [isInitialized]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      setVoices(allVoices);
      // Default to a natural female English voice if available
      if (!selectedVoice && allVoices.length > 0) {
        const preferred = allVoices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female'))
          || allVoices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('woman'))
          || allVoices.find(v => v.lang.startsWith('en'))
          || allVoices[0];
        setSelectedVoice(preferred?.name || allVoices[0].name);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // Speak Jules' reply if voice is enabled
  useEffect(() => {
    if (voiceEnabled && messages.length > 0 && selectedVoice) {
      const last = messages[messages.length - 1];
      if (last.sender === "jules" && last.text) {
        // Stop any current speech to prevent overlapping
        window.speechSynthesis.cancel();
        const utter = new window.SpeechSynthesisUtterance(last.text);
        utter.lang = "en-US";
        const voice = voices.find(v => v.name === selectedVoice);
        if (voice) utter.voice = voice;
        window.speechSynthesis.speak(utter);
      }
    }
  }, [messages, voiceEnabled, selectedVoice, voices]);

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageText = inputText;
    setInputText("");
    setIsLoading(true);

    const userId = getUserIdFromToken() || '687986e4107cd935660bd46d'; // Use test user if no token

    try {
      // If user asks for examples, fetch images
      if (/show me examples|show me|visual examples|can i see|more|again|another/i.test(messageText)) {
        // Use the current user message, not Jules's responses
        const data = await chat.sendMessage(messageText, userId);
        const julesTextMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: data.reply || data.response || "I'm having trouble responding right now. Try again!",
          sender: "jules",
          timestamp: new Date(),
          type: "text"
        };
        const newMessages: Message[] = [julesTextMessage];
        if (data.images && data.images.length > 0) {
          newMessages.push({
            id: (Date.now() + 2).toString(),
            sender: "jules",
            timestamp: new Date(),
            type: "images",
            images: data.images
          });
        }
        if (data.products && data.products.length > 0) {
          newMessages.push({
            id: (Date.now() + 3).toString(),
            sender: "jules",
            timestamp: new Date(),
            type: "products",
            products: data.products
          });
        }
        setMessages((prev) => [...prev, ...newMessages]);
      } else {
        const data = await chat.sendMessage(messageText, userId);
        const julesTextMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: data.reply || data.response || "I'm having trouble responding right now. Try again!",
          sender: "jules",
          timestamp: new Date(),
          type: "text"
        };
        const newMessages: Message[] = [julesTextMessage];
        if (data.images && data.images.length > 0) {
          newMessages.push({
            id: (Date.now() + 2).toString(),
            sender: "jules",
            timestamp: new Date(),
            type: "images",
            images: data.images
          });
        }
        if (data.products && data.products.length > 0) {
          newMessages.push({
            id: (Date.now() + 3).toString(),
            sender: "jules",
            timestamp: new Date(),
            type: "products",
            products: data.products
          });
        }
        setMessages((prev) => [...prev, ...newMessages]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      let errorText = "Sorry, I'm having trouble connecting right now. Please try again!";
      
      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          errorText = "Cannot connect to server. Please check your connection and try again.";
        } else if (error.message.includes('CORS')) {
          errorText = "Connection blocked. Please try again or contact support.";
        } else {
          errorText = `Error: ${error.message}`;
        }
      }
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: errorText,
        sender: "jules",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-100 via-white to-gray-200 pb-safe">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-semibold">
            J
          </div>
          <h1 className="font-semibold text-lg text-gray-900">Jules</h1>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          {/* Hide voice controls on mobile to save space */}
          <div className="hidden md:flex items-center gap-2">
            <select
              value={selectedVoice}
              onChange={e => setSelectedVoice(e.target.value)}
              className="px-2 py-1 rounded border text-sm bg-white text-gray-700"
              title="Select Jules' Voice"
            >
              {voices.map(v => (
                <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
              ))}
            </select>
            <button
              onClick={() => setVoiceEnabled((v) => !v)}
              className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${voiceEnabled ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300'}`}
              title="Toggle Jules Voice"
            >
              {voiceEnabled ? '🔊 Voice On' : '🔇 Voice Off'}
            </button>
          </div>
          {/* Mobile-optimized back button */}
          <Link
            href="/"
            className="text-gray-500 hover:text-gray-700 transition-colors p-2"
            title="Back to Home"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-2">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-end gap-2 ${
                message.sender === "user" ? "justify-end flex-row-reverse" : "justify-start flex-row"
              }`}
              style={message.sender === "user" ? { justifyContent: 'flex-end' } : {}}
            >
              {/* Avatar */}
              {message.sender === "jules" ? (
                <Image src="/jules-mvp.png" alt="Jules avatar" width={36} height={36} className="rounded-full shadow" />
              ) : (
                <div className="w-9 h-9 bg-blue-400 text-white rounded-full flex items-center justify-center font-bold text-lg shadow">{getUserInitialFromToken()}</div>
              )}
              <div
                className={`relative max-w-xs md:max-w-md px-4 py-2 rounded-2xl text-base shadow-sm whitespace-pre-line ${
                  message.sender === "user"
                    ? "bg-blue-500 text-white rounded-br-md text-right ml-auto"
                    : "bg-gray-200 text-gray-900 rounded-bl-md text-left mr-auto"
                }`}
                style={message.sender === "user" ? { marginLeft: 'auto' } : { marginRight: 'auto' }}
              >
                {/* Always show text if present */}
                {message.text && <div>{message.text}</div>}
                {/* Show images if present and type is 'images' */}
                {message.type === 'images' && message.images && message.images.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {message.images.slice(0, 4).map((url, idx) => (
                      safeString(url) ? (
                        <img key={idx} src={safeString(url)} alt={safeString(url) || 'Outfit example'} className="w-40 h-48 object-cover rounded-lg shadow" />
                      ) : (
                        <div key={idx} className="w-40 h-48 flex items-center justify-center bg-gray-100 text-gray-400 rounded-lg shadow">No Image</div>
                      )
                    ))}
                  </div>
                )}
                {/* Show products if present */}
                {message.products && message.products.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {message.products.map((prod, idx) => (
                      <a
                        key={idx}
                        href={prod.link ?? ''}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white rounded-xl shadow p-3 flex flex-col items-center border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer"
                        style={{ textDecoration: 'none' }}
                      >
                        {safeString(prod.image) ? (
                          <img src={safeString(prod.image)} alt={safeString(prod.title) || 'Product image'} className="w-32 h-32 object-contain mb-2 rounded" />
                        ) : (
                          <div className="w-32 h-32 flex items-center justify-center bg-gray-100 text-gray-400 mb-2 rounded">No Image</div>
                        )}
                        <div className="font-semibold text-gray-900 text-center mb-1 line-clamp-2">{prod.title ?? ''}</div>
                        {prod.price && (
                          <div className="text-gray-700 text-sm mb-1">{prod.price ?? ''}</div>
                        )}
                        {prod.description && (
                          <div className="text-gray-600 text-xs mt-1 text-center line-clamp-3">{prod.description}</div>
                        )}
                      </a>
                    ))}
                  </div>
                )}
                <span
                  className={`block text-xs mt-1 ${
                    message.sender === "user" ? "text-blue-100" : "text-gray-500"
                  }`}
                >
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ))}
          {/* Jules is typing indicator */}
          {isLoading && (
            <div className="flex items-end gap-2 justify-start flex-row">
              <Image src="/jules-mvp.png" alt="Jules avatar" width={36} height={36} className="rounded-full shadow" />
              <div className="relative max-w-xs md:max-w-md px-4 py-2 rounded-2xl text-base shadow-sm bg-gray-200 text-gray-900 rounded-bl-md text-left mr-auto animate-pulse">
                <span>Jules is typing…</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="bg-white/80 backdrop-blur border-t px-4 py-3 flex items-center justify-between shadow-sm sticky bottom-0 z-10">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyPress}
          className="flex-1 px-4 py-2 rounded-full border text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Type your message..."
        />
        <button
          onClick={sendMessage}
          disabled={!inputText.trim() || isLoading}
          className="ml-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          title="Send message"
        >
          {isLoading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}