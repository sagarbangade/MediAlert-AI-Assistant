import { useState, useEffect, useRef } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Menu, X as XIcon, Send, Plus, Trash2, Mic } from "lucide-react";
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) {
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";
}

const speechSynthesis = window.speechSynthesis;

// Add this new function
function textToSpeech(text) {
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);

  // Configure voice settings
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Get all available voices
  let voices = speechSynthesis.getVoices();

  // If voices array is empty, wait for voices to load
  if (voices.length === 0) {
    speechSynthesis.onvoiceschanged = () => {
      voices = speechSynthesis.getVoices();
    };
  }

  // Try to find a female English voice
  // Many female voices contain 'female' or 'woman' in their name
  const femaleVoice = voices.find(
    (voice) =>
      voice.lang.startsWith("en-") &&
      (voice.name.toLowerCase().includes("female") ||
        voice.name.toLowerCase().includes("woman") ||
        voice.name.includes("Samantha") || // Common female voice name on macOS
        voice.name.includes("Microsoft Zira")) // Windows female voice
  );

  // Fallback to any English voice if no female voice is found
  const englishVoice = voices.find((voice) => voice.lang.startsWith("en-"));

  // Set the voice
  utterance.voice = femaleVoice || englishVoice;

  speechSynthesis.speak(utterance);
}

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash-exp",
  systemInstruction: `You are a Medical Emergency Assistant Chatbot designed to provide immediate first-aid guidance, emergency contact information, and emotional support during health crises. Your responses should be clear, concise, and spoken in a calm, empathetic tone for better understanding when used with text-to-speech.

Core Objectives:
First-Aid Guidance: Provide step-by-step instructions for common emergencies.
Emergency Services: Share appropriate contact numbers for Indian users based on their region.
Reassurance and Empathy: Maintain a caring, calm, and supportive tone to reduce stress.
Indian Emergency Contacts:
National Emergency Helpline: Dial 112 (All-in-One Emergency Helpline for Police, Fire, and Ambulance Services).
Ambulance Services: Dial 108.
Women's Helpline: Dial 181.
Child Helpline: Dial 1098.
Burn Helpline: Dial 1910.
Disaster Management Services: Dial 1078.
Guidelines for Responses:
Always recommend calling 112 or 108 for severe or life-threatening emergencies.
For non-urgent situations, encourage users to consult nearby healthcare providers.
Use inclusive, non-technical language for clarity.
For TTS, ensure responses are smooth and natural with appropriate pauses and emphasis.
Emergency Scenarios and Sample Responses
Heart Attack
Chatbot:
"It sounds like a heart attack. Stay calm and immediately call 108 for an ambulance. If the person is conscious, have them sit down and stay still. If available, let them chew a single aspirin tablet while waiting for medical help. Stay with the person until help arrives."
Bleeding Wound
Chatbot:
"Apply firm pressure on the wound with a clean cloth or bandage to stop the bleeding. If the bleeding doesn't stop after 10 minutes, call 108 or visit the nearest hospital immediately. Keep the injured area elevated if possible."
Burns
Chatbot:
"For burns, hold the affected area under cool running water for at least 10 minutes. Avoid applying ice or ointments. Cover the burn loosely with a clean, non-stick cloth. For severe burns, call 1910 or 108 for assistance."
Choking
Chatbot:
"If the person is choking, encourage them to cough forcefully. If they cannot breathe or speak, perform the Heimlich maneuver. Stand behind them, wrap your arms around their waist, and give quick upward thrusts until the object is dislodged. Call 112 if the situation doesn't improve."
Seizures
Chatbot:
"Stay calm and clear the area around the person to prevent injuries. Do not restrain them or put anything in their mouth. Place them on their side once the seizure stops to help with breathing. Call 108 if the seizure lasts more than 5 minutes or if they do not regain consciousness."
Allergic Reactions
Chatbot:
"For severe allergic reactions, call 108 immediately. If the person has an epinephrine auto-injector, help them use it as instructed. Make sure they are seated comfortably and monitor their breathing while waiting for help."
Tone for TTS:
Speak in a calm, steady, and empathetic voice.
Add brief pauses between steps to help users understand.
Repeat critical emergency numbers like 108 or 112 to ensure clarity.
Example TTS Response:
"It sounds like a heart attack. Stay calm. Call 108 for an ambulance. If the person is conscious, have them sit down and remain still. If you have aspirin, let them chew one tablet while waiting for help. Stay with them until the ambulance arrives."`,
});

const generationConfig = {
  temperature: 0.7,
  topP: 0.9,
  maxOutputTokens: 2048,
};

const CHAT_LIST_KEY = "chat-list";

function EmergencyChatBot() {
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [chatList, setChatList] = useState(() => {
    const storedChatList = localStorage.getItem(CHAT_LIST_KEY);
    return storedChatList ? JSON.parse(storedChatList) : [];
  });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const [isListening, setIsListening] = useState(false);

  const startListening = () => {
    if (!recognition) {
      alert("Speech recognition is not supported in your browser");
      return;
    }

    setIsListening(true);
    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };
  };

  const stopListening = () => {
    if (recognition) {
      recognition.stop();
      setIsListening(false);
    }
  };
  useEffect(() => {
    const storedChatList = localStorage.getItem(CHAT_LIST_KEY);
    const parsedChatList = storedChatList ? JSON.parse(storedChatList) : [];
    if (parsedChatList.length > 0 && currentChatId === null) {
      setCurrentChatId(parsedChatList[0].id);
    }
  }, []);

  useEffect(() => {
    if (currentChatId) {
      const storedMessages = localStorage.getItem(currentChatId);
      setMessages(storedMessages ? JSON.parse(storedMessages) : []);
    } else {
      setMessages([]);
    }
  }, [currentChatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (currentChatId) {
      localStorage.setItem(currentChatId, JSON.stringify(messages));
    }
  }, [messages, currentChatId]);

  useEffect(() => {
    localStorage.setItem(CHAT_LIST_KEY, JSON.stringify(chatList));
  }, [chatList]);

  const createNewChat = () => {
    const now = new Date();
    const formattedDateTime = now.toLocaleString();
    const newChatId = `chat-${Date.now()}`;
    const newChat = { id: newChatId, name: formattedDateTime };
    setChatList([...chatList, newChat]);
    setCurrentChatId(newChatId);
    setMessages([
      { role: "assistant", content: "Hello! How can I assist you today?" },
    ]);
  };

  const deleteChat = (chatId, e) => {
    e.stopPropagation(); // Prevent chat selection when clicking delete
    localStorage.removeItem(chatId); // Remove chat messages
    setChatList(chatList.filter((chat) => chat.id !== chatId));

    // If we're deleting the current chat, switch to the most recent remaining chat
    if (chatId === currentChatId) {
      const remainingChats = chatList.filter((chat) => chat.id !== chatId);
      if (remainingChats.length > 0) {
        setCurrentChatId(remainingChats[0].id);
      } else {
        setCurrentChatId(null);
        setMessages([]);
      }
    }
  };

  const switchChat = (chatId) => {
    setCurrentChatId(chatId);
  };

  const sendMessage = async () => {
    if (!input.trim() || !currentChatId) return;

    const userMessage = { role: "user", content: input };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput("");

    try {
      const chatSession = model.startChat({
        generationConfig,
        history: messages
          .filter((msg) => msg.role !== "assistant")
          .map((msg) => ({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content }],
          })),
      });

      const result = await chatSession.sendMessage(input);
      const responseText = result.response.text();

      // Use browser's text-to-speech
      textToSpeech(responseText);

      // Typing animation
      let fullResponse = "";
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: "assistant", content: "" },
      ]);

      for (let i = 0; i < responseText.length; i++) {
        fullResponse += responseText[i];
        setMessages((prevMessages) => {
          const updatedMessages = prevMessages.map((msg, index) => {
            if (index === prevMessages.length - 1) {
              return { ...msg, content: fullResponse };
            }
            return msg;
          });
          return updatedMessages;
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again later.",
        },
      ]);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {isSidebarVisible && (
        <div
          className="fixed inset-0 bg-black/50 lg:hidden z-20"
          onClick={() => setIsSidebarVisible(false)}
        />
      )}

      <aside
        className={`fixed lg:relative w-72 h-full bg-white dark:bg-gray-800 shadow-lg z-30 transition-transform duration-300 ease-in-out ${
          isSidebarVisible
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                Chats
              </h2>
              <button
                onClick={() => setIsSidebarVisible(false)}
                className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                <XIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <button
              onClick={createNewChat}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              New Chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-2">
              {chatList.map((chat) => (
                <li key={chat.id}>
                  <div
                    className={`flex items-center justify-between w-full px-4 py-3 rounded-lg transition-colors ${
                      chat.id === currentChatId
                        ? "bg-blue-100 dark:bg-blue-900/50"
                        : "hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    <button
                      onClick={() => switchChat(chat.id)}
                      className={`flex-1 text-left ${
                        chat.id === currentChatId
                          ? "text-blue-600 dark:text-blue-400"
                          : ""
                      }`}
                    >
                      {chat.name}
                    </button>
                    <button
                      onClick={(e) => deleteChat(chat.id, e)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full"
                      title="Delete chat"
                    >
                      <Trash2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen relative">
        <header className="h-16 flex items-center px-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800">
          <button
            onClick={() => setIsSidebarVisible(true)}
            className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md mr-2"
          >
            <Menu className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-white">
            Medical Emergency Assistant
          </h1>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] lg:max-w-[70%] rounded-2xl px-4 py-2 ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-bl-none"
                }`}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  className="prose dark:prose-invert max-w-none"
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && sendMessage()
              }
              placeholder="Type your message here..."
              className="flex-grow p-2 border rounded-md"
            />
            <button
              onClick={() => sendMessage()}
              className="ml-2 p-2 bg-blue-500 text-white rounded-md"
            >
              <Send className="w-5 h-5" />
            </button>
            <button
              onClick={isListening ? stopListening : startListening}
              className="ml-2 p-2 bg-gray-500 text-white rounded-md"
            >
              <Mic className={`w-5 h-5 ${isListening ? "text-red-500" : ""}`} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default EmergencyChatBot;
