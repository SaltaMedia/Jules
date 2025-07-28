"use client";
import { useState, useRef, useEffect } from "react";
import { chat } from "@/lib/api";
import Image from "next/image";
import { jwtDecode } from 'jwt-decode';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import OnboardingRedirect from '@/components/OnboardingRedirect';

// Speech Recognition types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

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
          const name = email.split('@')[0];
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

// Helper function to format date/time separators
function formatMessageTime(date: Date): string {
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  if (diffInHours < 24) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffInHours < 48) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

// Helper function to check if messages should be grouped
function shouldGroupMessages(current: Message, previous: Message | null): boolean {
  if (!previous) return false;
  
  const timeDiff = current.timestamp.getTime() - previous.timestamp.getTime();
  const fiveMinutes = 5 * 60 * 1000;
  
  return current.sender === previous.sender && timeDiff < fiveMinutes;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to dark mode
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize messages after component mounts to avoid hydration issues
  useEffect(() => {
    if (!isInitialized) {
      // Load messages from localStorage to preserve chat session
      const savedMessages = localStorage.getItem('chatMessages');
      if (savedMessages) {
        try {
          const parsedMessages = JSON.parse(savedMessages);
          // Convert timestamp strings back to Date objects
          const messagesWithDates = parsedMessages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
          setMessages(messagesWithDates);
        } catch (error) {
          console.error('Error loading saved messages:', error);
          setMessages([]);
        }
      } else {
        setMessages([]);
      }
      setIsInitialized(true);
    }
  }, [isInitialized]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputText(transcript);
          setIsListening(false);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
    // Save messages to localStorage to preserve chat session
    if (messages.length > 0) {
      localStorage.setItem('chatMessages', JSON.stringify(messages));
    }
  }, [messages]);

  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      setVoices(allVoices);
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

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);

    try {
      const userId = getUserIdFromToken();
      if (!userId) {
        throw new Error('User not authenticated');
      }
      const response = await chat.sendMessage(inputText, userId);
      
      const julesMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.reply,
        sender: "jules",
        timestamp: new Date(),
        type: response.products && response.products.length > 0 ? "products" : "text",
        products: response.products || [],
      };

      setMessages(prev => [...prev, julesMessage]);

      // Voice synthesis
      if (voiceEnabled && response.reply) {
        const utterance = new SpeechSynthesisUtterance(response.reply);
        utterance.voice = voices.find(v => v.name === selectedVoice) || null;
        window.speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I'm having trouble connecting right now. Please try again.",
        sender: "jules",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleVoiceRecognition = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Keep messages as single bubbles - let them size naturally
  const getMessageContent = (text: string): string[] => {
    return [text]; // Keep as single bubble
  };

  return (
    <OnboardingRedirect>
      <div className={`min-h-screen flex flex-col transition-colors duration-300 ${
        isDarkMode 
          ? 'bg-[#121212] text-gray-100' 
          : 'bg-gray-50 text-gray-900'
      }`}>
      {/* Header - 8-point grid spacing */}
      <header className={`px-4 py-3 flex items-center justify-between shadow-sm transition-colors duration-300 ${
        isDarkMode 
          ? 'bg-gray-900/80 backdrop-blur border-gray-800' 
          : 'bg-white/80 backdrop-blur border-gray-200'
      } border-b`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-semibold">
            J
          </div>
          <h1 className="font-semibold text-lg">Jules</h1>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Settings Icon */}
          <Link
            href="/settings"
            className={`p-2 rounded-lg transition-colors duration-200 ${
              isDarkMode 
                ? 'text-gray-300 hover:text-white hover:bg-gray-800' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            aria-label="Settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
          
          {/* Theme Toggle */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2 rounded-lg transition-colors duration-200 ${
              isDarkMode 
                ? 'text-gray-300 hover:text-white hover:bg-gray-800' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkMode ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Messages - 8-point grid spacing */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        <div className="max-w-2xl mx-auto flex flex-col gap-2">
          {messages.map((message, index) => {
            const previousMessage = index > 0 ? messages[index - 1] : null;
            const shouldGroup = shouldGroupMessages(message, previousMessage);
                         const messageChunks = message.text ? getMessageContent(message.text) : [];
            
            return (
              <div key={message.id} className="space-y-1">
                {/* Date/Time Separator */}
                {!shouldGroup && (
                  <div className="flex justify-center py-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      isDarkMode 
                        ? 'bg-gray-800 text-gray-400' 
                        : 'bg-gray-200 text-gray-500'
                    }`}>
                      {formatMessageTime(message.timestamp)}
                    </span>
                  </div>
                )}
                
                {/* Message Bubbles */}
                <div className={`flex items-end gap-2 ${
                  message.sender === "user" ? "justify-end" : "justify-start"
                }`}>
                  {/* Avatar - only show for first message in group */}
                  {!shouldGroup && message.sender === "jules" && (
                    <Image 
                      src="/jules-mvp.png" 
                      alt="Jules avatar" 
                      width={32} 
                      height={32} 
                      className="rounded-full shadow-sm flex-shrink-0" 
                    />
                  )}
                  
                  {/* Message Content */}
                  <div className={`flex flex-col gap-1 ${
                    message.sender === "user" ? "items-end" : "items-start"
                  }`}>
                                         {messageChunks.map((chunk: string, chunkIndex: number) => (
                       <div
                         key={chunkIndex}
                         className={`max-w-xs md:max-w-md lg:max-w-lg px-3 py-2 rounded-xl text-base shadow-sm ${
                          message.sender === "user"
                            ? isDarkMode
                              ? 'bg-blue-600 text-white'
                              : 'bg-blue-500 text-white'
                            : isDarkMode
                              ? 'bg-gray-800 text-gray-100'
                              : 'bg-gray-50 text-gray-800 border border-gray-200'
                        }`}
                        style={{
                          animation: 'fadeInUp 0.3s ease-out',
                          animationFillMode: 'both',
                          animationDelay: `${chunkIndex * 0.1}s`
                        }}
                      >
                        <div className="leading-relaxed prose prose-sm max-w-none">
                          <ReactMarkdown>{chunk.replace(/- \*\*(.*?)\*\*:/g, '\n\n- **$1:**').replace(/([.!?])\s+-/g, '$1\n\n-')}</ReactMarkdown>
                        </div>
                      </div>
                    ))}
                    
                    {/* Product Cards */}
                    {message.products && message.products.length > 0 && (
                      <div className="mt-3 overflow-x-auto">
                        <div className="flex gap-3 pb-2">
                          {message.products.map((prod, idx) => (
                            <a
                              key={idx}
                              href={prod.link ?? ''}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`min-w-[200px] rounded-xl shadow-sm border transition-all duration-200 hover:scale-105 hover:shadow-md ${
                                isDarkMode
                                  ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
                                  : 'bg-white border-gray-200 hover:border-gray-300'
                              }`}
                              style={{ textDecoration: 'none' }}
                            >
                              <div className="p-3">
                                {safeString(prod.image) ? (
                                  <img 
                                    src={safeString(prod.image)} 
                                    alt={safeString(prod.title) || 'Product image'} 
                                    className="w-full h-32 object-cover rounded-lg mb-3" 
                                  />
                                ) : (
                                  <div className={`w-full h-32 flex items-center justify-center rounded-lg mb-3 ${
                                    isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-400'
                                  }`}>
                                    No Image
                                  </div>
                                )}
                                <div className="font-semibold text-sm mb-1 line-clamp-2">
                                  {prod.title ?? ''}
                                </div>
                                {prod.price && (
                                  <div className={`text-sm ${
                                    isDarkMode ? 'text-blue-300' : 'text-blue-600'
                                  }`}>
                                    {prod.price}
                                  </div>
                                )}
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* User Avatar - only show for first message in group, positioned after message content */}
                  {!shouldGroup && message.sender === "user" && (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0 ${
                      isDarkMode 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-blue-600 text-white'
                    }`}>
                      {getUserInitialFromToken()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {/* Typing Indicator */}
          {isLoading && (
            <div className="flex items-end gap-2 justify-start">
              <Image 
                src="/jules-mvp.png" 
                alt="Jules avatar" 
                width={32} 
                height={32} 
                className="rounded-full shadow-sm flex-shrink-0" 
              />
              <div className={`px-3 py-2 rounded-xl shadow-sm ${
                isDarkMode 
                  ? 'bg-gray-800 text-gray-100' 
                  : 'bg-white text-gray-900 border border-gray-200'
              }`}>
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Bar - Fixed at bottom */}
      <div className={`px-4 py-3 border-t transition-colors duration-300 ${
        isDarkMode 
          ? 'bg-gray-900/80 backdrop-blur border-gray-800' 
          : 'bg-gray-50/80 backdrop-blur border-gray-200'
      }`}>
        <div className="max-w-2xl mx-auto">
          <div className={`flex items-center gap-2 p-2 rounded-xl border transition-colors duration-300 ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-700 focus-within:border-gray-600' 
              : 'bg-white border-gray-200 focus-within:border-blue-400'
          }`}>
            {/* Attachment Icon */}
            <button
              className={`p-2 rounded-lg transition-colors duration-200 ${
                isDarkMode 
                  ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
              aria-label="Attach file"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            
            {/* Text Input */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyPress}
              className={`flex-1 px-2 py-1 text-base bg-transparent outline-none transition-colors duration-300 ${
                isDarkMode 
                  ? 'text-gray-100 placeholder-gray-400' 
                  : 'text-gray-900 placeholder-gray-500'
              }`}
              placeholder="Type your message..."
              aria-label="Message input"
            />
            
            {/* Voice Input Icon */}
            <button
              onClick={toggleVoiceRecognition}
              className={`p-2 rounded-lg transition-colors duration-200 ${
                isListening
                  ? isDarkMode
                    ? 'text-red-400 bg-red-900/20 animate-pulse'
                    : 'text-red-600 bg-red-50 animate-pulse'
                  : isDarkMode
                    ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
              aria-label={isListening ? "Stop listening" : "Start voice recognition"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
            

            
            {/* Send Button */}
            <button
              onClick={sendMessage}
              disabled={!inputText.trim() || isLoading}
              className={`p-2 rounded-lg transition-all duration-200 ${
                inputText.trim() && !isLoading
                  ? isDarkMode
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                  : isDarkMode
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
              aria-label="Send message"
            >
              {isLoading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      <div ref={messagesEndRef} />


      </div>
    </OnboardingRedirect>
  );
}