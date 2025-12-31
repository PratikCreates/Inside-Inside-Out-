import { useState, useEffect, useRef } from 'react'
import { Mic, Send, MicOff, Sparkles, MessageSquare, Phone, PhoneOff, Smile, Frown, Flame, Ghost, Skull, SlidersHorizontal, Lock, ArrowRight, Play } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import './index.css'

// Configuration
const API_URL = "http://localhost:8000/api"

// Added Icons for "Faces" - VIBRANT COLORS
const PERSONAS = [
  { name: "Headquarters", color: "from-slate-500 to-slate-700", glow: "shadow-slate-400/60", icon: <ActivityIcon />, vibe: "Ready & Waiting" },
  { name: "Joy", color: "from-amber-300 to-yellow-500", glow: "shadow-yellow-400/90", icon: <Smile className="w-6 h-6 text-white/90" />, vibe: "Radiant" },
  { name: "Sadness", color: "from-sky-400 to-blue-600", glow: "shadow-blue-500/90", icon: <Frown className="w-6 h-6 text-white/90" />, vibe: "Melancholic" },
  { name: "Anger", color: "from-red-500 to-rose-700", glow: "shadow-red-500/90", icon: <Flame className="w-6 h-6 text-white/90" />, vibe: "Fiery" },
  { name: "Fear", color: "from-violet-400 to-purple-700", glow: "shadow-purple-500/90", icon: <Ghost className="w-6 h-6 text-white/90" />, vibe: "Nervous" },
  { name: "Disgust", color: "from-emerald-400 to-green-600", glow: "shadow-emerald-500/90", icon: <Skull className="w-6 h-6 text-white/90" />, vibe: "Sassy" },
]

function ActivityIcon() {
  return (
    <svg className="w-6 h-6 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

// Typewriter Component - Fixed version
const Typewriter = ({ text }) => {
  const [displayedText, setDisplayedText] = useState('')
  const indexRef = useRef(0)

  useEffect(() => {
    // Reset when text changes
    indexRef.current = 0
    setDisplayedText('')

    const interval = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayedText(text.slice(0, indexRef.current + 1))
        indexRef.current++
      } else {
        clearInterval(interval)
      }
    }, 25)

    return () => clearInterval(interval)
  }, [text])

  return <span>{displayedText}</span>
}

function App() {
  const [activePersona, setActivePersona] = useState(PERSONAS[0])
  const [inputText, setInputText] = useState("")
  const [lastMessage, setLastMessage] = useState(null)
  const [showInput, setShowInput] = useState(false)
  const [debugLog, setDebugLog] = useState("")

  const [isProcessing, setIsProcessing] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  // Judge Mode Config State
  const [showConfig, setShowConfig] = useState(false)
  const [apiKeys, setApiKeys] = useState({ gemini: '', eleven: '' })
  const [keyStatus, setKeyStatus] = useState({ loading: false, error: null, success: false })
  const [keysDetected, setKeysDetected] = useState(false)

  // Auto-detect keys on mount
  useEffect(() => {
    const checkKeys = async () => {
      const savedGemini = localStorage.getItem('gemini_key')
      const savedEleven = localStorage.getItem('eleven_key')

      if (savedGemini || savedEleven) {
        setApiKeys({ gemini: savedGemini || '', eleven: savedEleven || '' })
        setKeysDetected(true)
        // Auto-configure backend if keys exist
        try {
          await fetch(`${API_URL}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gemini_key: savedGemini, eleven_key: savedEleven })
          })
        } catch (err) {
          console.error("Auto-config failed:", err)
        }
      } else {
        // No keys found - check backend for .env keys
        try {
          const testRes = await fetch(`${API_URL}/warroom`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'test', target_personas: ['Joy'] })
          })

          if (testRes.ok) {
            // Backend has keys in .env
            setKeysDetected(true)
          } else {
            // No keys detected - show config popup after a brief delay
            setTimeout(() => setShowConfig(true), 1500)
          }
        } catch (err) {
          // Backend error - show config popup
          setTimeout(() => setShowConfig(true), 1500)
        }
      }
    }
    checkKeys()
  }, [])

  const handleSaveKeys = async () => {
    console.log("Saving keys...", apiKeys)
    if (!apiKeys.gemini && !apiKeys.eleven) {
      setKeyStatus({ loading: false, error: "Please enter at least one API key.", success: false })
      return
    }

    setKeyStatus({ loading: true, error: null, success: false })

    try {
      // Quick validation test - send a minimal test request
      const res = await fetch(`${API_URL}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gemini_key: apiKeys.gemini, eleven_key: apiKeys.eleven })
      })

      if (res.ok) {
        // Save to localStorage
        if (apiKeys.gemini) localStorage.setItem('gemini_key', apiKeys.gemini)
        if (apiKeys.eleven) localStorage.setItem('eleven_key', apiKeys.eleven)

        setKeyStatus({ loading: false, error: null, success: true })
        setKeysDetected(true)

        // Close modal after brief success display
        setTimeout(() => {
          setShowConfig(false)
          setKeyStatus({ loading: false, error: null, success: false })
        }, 1000)
      } else {
        const err = await res.text()
        console.error("Config error:", err)
        setKeyStatus({ loading: false, error: "Failed to validate keys. Check your API keys.", success: false })
      }
    } catch (e) {
      console.error("Save error:", e)
      setKeyStatus({ loading: false, error: "Connection error. Make sure backend is running.", success: false })
    }
  }
  const [viewMode, setViewMode] = useState('home') // 'home', 'scenario'
  const [selectedPersonas, setSelectedPersonas] = useState(PERSONAS.filter(p => p.name !== 'Headquarters').map(p => p.name)) // Multi-select support


  // Speech State
  const [isListening, setIsListening] = useState(false)
  const [isUserSpeaking, setIsUserSpeaking] = useState(false)
  const [callActiveState, setCallActiveState] = useState(false)

  const audioRef = useRef(new Audio())
  const recognitionRef = useRef(null)

  const isCallActive = useRef(false)
  const latestInputText = useRef("")
  const silenceTimer = useRef(null)

  const isProcessingRef = useRef(false) // Track processing state for callbacks

  // Sync ref with state
  useEffect(() => {
    isProcessingRef.current = isProcessing
  }, [isProcessing])

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      console.log("Speech Recognition is available")
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = true
      recognitionRef.current.interimResults = true
      recognitionRef.current.maxAlternatives = 1
      recognitionRef.current.lang = 'en-US'

      recognitionRef.current.onstart = () => {
        console.log("Recognition onstart fired")
        setIsListening(true)
        setDebugLog("Listening...")
      }

      recognitionRef.current.onerror = (e) => {
        console.error("Speech recognition error:", e.error)
        // If aborted or no-speech, we might want to restart if still active
        if (e.error === 'no-speech' && isCallActive.current && !isProcessingRef.current) {
          // Just ignore, it will likely stay active or hit onend
        }
      }

      recognitionRef.current.onresult = (event) => {
        setIsUserSpeaking(true)
        // Interrupt AI if speaking
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause()
          audioRef.current.currentTime = 0
          setIsPlaying(false)
        }

        let transcript = ''
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript
        }

        const trimmed = transcript.trim()
        if (trimmed) {
          setInputText(trimmed)
          latestInputText.current = trimmed

          // Debounce: Wait for pause in speech before sending
          if (silenceTimer.current) clearTimeout(silenceTimer.current)
          silenceTimer.current = setTimeout(() => {
            setIsUserSpeaking(false)
            if (latestInputText.current.length > 0) {
              // STOP listening to process
              recognitionRef.current.stop()
              handleSend(latestInputText.current)
            }
          }, 1200) // 1.2s silence
        }
      }

      recognitionRef.current.onend = () => {
        console.log("Recognition END. Active:", isCallActive.current, "Processing:", isProcessingRef.current)
        setIsListening(false)
        setIsUserSpeaking(false)

        // ONLY restart if we are supposed to be active (Always Listening)
        if (isCallActive.current) {
          console.log("Auto-restarting listener for continuous input...")
          setTimeout(() => {
            try { recognitionRef.current.start() } catch (e) { }
          }, 100)
        }
      }
    } else {
      console.error("Speech Recognition NOT available in this browser")
      alert("Speech recognition is not supported in this browser. Please use Chrome.")
    }
  }, []) // Run once on mount

  const startCall = () => {
    console.log("Starting call...")
    isCallActive.current = true
    setCallActiveState(true)
    setIsListening(true) // Set immediately for UI feedback
    latestInputText.current = ""
    setInputText("")
    if (audioRef.current) audioRef.current.pause()

    try {
      recognitionRef.current.start()
      console.log("Speech recognition started")
    } catch (e) {
      console.error("Failed to start speech recognition:", e)
      // Maybe it's already running, try stopping and restarting
      try {
        recognitionRef.current.stop()
        setTimeout(() => {
          try { recognitionRef.current.start() } catch (e2) { console.error(e2) }
        }, 100)
      } catch (e2) { }
    }
  }

  const stopCall = () => {
    isCallActive.current = false
    setCallActiveState(false)
    setIsListening(false)
    setIsUserSpeaking(false)
    if (silenceTimer.current) clearTimeout(silenceTimer.current)
    try { recognitionRef.current.stop() } catch (e) { }
    setDebugLog("Call Ended.")
  }

  const toggleCall = () => {
    if (isCallActive.current) stopCall()
    else startCall()
  }

  const handleSend = async (textOverride = null, personaOverride = null) => {
    const text = textOverride || latestInputText.current
    if (!text || !text.trim()) return

    latestInputText.current = ""
    setInputText("")

    setIsProcessing(true)
    setLastMessage({ role: 'user', text: text, persona: 'You' })

    try {
      // Call warroom for multi-agent response
      const warroomRes = await fetch(`${API_URL}/warroom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          target_persona: personaOverride,
          target_personas: selectedPersonas.length > 0 ? selectedPersonas : undefined
        })
      })

      const warroomData = await warroomRes.json()
      const responses = warroomData.responses || []

      if (responses.length === 0) {
        setLastMessage({ role: 'system', text: "No response.", persona: "System" })
        setIsProcessing(false)
        return
      }

      // Play each response sequentially
      const playSequence = async (index) => {
        if (index >= responses.length) {
          // All done - clear and restart listening
          setTimeout(() => setLastMessage(null), 800) // Faster clear
          setIsProcessing(false)
          if (isCallActive.current) {
            try { recognitionRef.current.start() } catch (e) { }
          }
          return
        }

        const item = responses[index]
        const personaName = item.persona
        const responseText = item.text  // Use text as-is from backend

        // Fetch audio for this segment FIRST (don't show text yet)
        const audioRes = await fetch(`${API_URL}/warroom/audio`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ persona: personaName, text: responseText })
        })

        const audioBlob = await audioRes.blob()
        const audioUrl = URL.createObjectURL(audioBlob)

        audioRef.current.src = audioUrl

        // Wait for audio to be ready, then switch persona, show text, AND play simultaneously
        audioRef.current.oncanplaythrough = () => {
          // Switch persona NOW (synchronized with text and audio)
          const p = PERSONAS.find(p => p.name === personaName)
          if (p) setActivePersona(p)
          // Show the subtitle (synced with audio start)
          setLastMessage({ role: 'ai', text: responseText, persona: personaName })
          setIsPlaying(true)
          audioRef.current.play().catch(e => console.error(e))
        }

        // Load the audio
        audioRef.current.load()

        audioRef.current.onended = () => {
          setIsPlaying(false)
          // Clear text when audio ends
          setLastMessage(null)
          // Quick transition between speakers
          setTimeout(() => playSequence(index + 1), 200)
        }
      }

      // Start playing the sequence
      await playSequence(0)

    } catch (e) {
      console.error(e)
      setLastMessage({ role: 'system', text: "Connection Lost.", persona: "System" })
      setIsProcessing(false)
    }
  }

  /* ADVANCED DEBATE MODE */
  const abortDebateRef = useRef(false)
  // State is defined at top level for viewMode


  // Triggered by the UI Modal
  /* ADVANCED STREAMING DEBATE MODE */
  const audioQueueRef = useRef([])
  const isQueuePlayingRef = useRef(false)

  // Rebranded as Fun Mode
  const startFunMode = async (topic, mode) => {
    setViewMode('home') // Return to home view
    if (!topic) return

    abortDebateRef.current = false
    setIsProcessing(true)
    audioQueueRef.current = []

    // Show 'Connecting' state
    setLastMessage({ role: 'system', text: "Initializing Fun Mode...", persona: "Headquarters" })

    try {
      const response = await fetch(`${API_URL}/funmode/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: topic,
          mode: mode,
          target_personas: selectedPersonas.length > 0 ? selectedPersonas : undefined
        })
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      // Start the consumer loop immediately
      processQueue()

      while (true) {
        if (abortDebateRef.current) break
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value) // Decode fully without stream option for now
        console.log("Stream chunk received. Buffer length:", buffer.length)
        const lines = buffer.split("\n")
        buffer = lines.pop() // Keep incomplete chunk

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const data = JSON.parse(line)
            if (data.persona && data.text) {
              // We got a line! Immediately fetch audio for it.
              fetchAudioAndQueue(data)
            }
          } catch (e) {
            console.error("JSON parse error", e, line)
          }
        }
      }

      // AUTO-TERMINATION: Wait for queue to finish before ending processing
      const checkCompletion = setInterval(() => {
        if (audioQueueRef.current.length === 0 && !isQueuePlayingRef.current) {
          clearInterval(checkCompletion)
          if (!abortDebateRef.current) {
            setIsProcessing(false)
            setLastMessage(null)
            setActivePersona(PERSONAS[0])
          }
        }
      }, 1000)

    } catch (e) {
      console.error("Streaming error", e)
      setLastMessage({ role: 'system', text: "Connection Lost.", persona: "System" })
    }
  }

  // Fetch Audio and add to Queue
  const fetchAudioAndQueue = async (item) => {
    try {
      const audioRes = await fetch(`${API_URL}/warroom/audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: item.persona, text: item.text })
      })
      const audioBlob = await audioRes.blob()
      const audioUrl = URL.createObjectURL(audioBlob)

      // Add to queue
      audioQueueRef.current.push({ ...item, audioUrl })

      // Trigger player if idle
      if (!isQueuePlayingRef.current) processQueue()

    } catch (e) {
      console.error("Audio fetch failed", e)
    }
  }

  // Linear Queue Player
  const processQueue = async () => {
    if (isQueuePlayingRef.current) return
    if (audioQueueRef.current.length === 0) {
      // Queue empty. If processing is done, we might be finished.
      // But the stream might still be open. We just return and wait for next push.
      return
    }

    isQueuePlayingRef.current = true
    const item = audioQueueRef.current.shift()

    // Play
    audioRef.current.src = item.audioUrl

    await new Promise((resolve) => {
      audioRef.current.oncanplaythrough = () => {
        // Switch persona NOW (synchronized with text and audio)
        const p = PERSONAS.find(p => p.name === item.persona)
        if (p) setActivePersona(p)
        setLastMessage({ role: 'ai', text: item.text, persona: item.persona })
        setIsPlaying(true)
        audioRef.current.play().catch(e => {
          console.error("Play error", e)
          resolve()
        })
      }
      audioRef.current.onended = () => {
        setIsPlaying(false)
        // Small pause between speakers
        setTimeout(resolve, 300)
      }
      // Fallback timeout
      audioRef.current.onerror = resolve
    })

    isQueuePlayingRef.current = false

    // Process next
    if (!abortDebateRef.current) {
      processQueue()
    } else {
      setIsProcessing(false)
      setLastMessage(null)
      setActivePersona(PERSONAS[0])
    }
  }


  const stopDebate = () => {
    abortDebateRef.current = true;
    if (audioRef.current) audioRef.current.pause();
    setIsProcessing(false);
    setLastMessage(null);
    setActivePersona(PERSONAS[0]);
  }


  // RENDER - PREMIUM UI
  return (
    <div className="min-h-screen bg-black text-white overflow-hidden flex flex-col font-sans relative selection:bg-purple-500/30">

      {/* Background Ambience - NEW HQ IMAGE */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-black" />
        <img src="/hq-bg.png" className={`absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen transition-all duration-1000 ${viewMode === 'scenario' ? 'blur-xl scale-110 opacity-30' : ''}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" />
      </div>

      {/* TOP HEADER - Minimal, just tools */}
      <div className="relative z-50 p-6 flex justify-end items-start pointer-events-none">
        {/* Logo was here, now moved for scale */}
      </div>

      {/* MAIN STAGE - COMPACT VERTICAL LAYOUT */}
      <main className="flex-1 relative z-10 flex flex-col items-center justify-center w-full max-w-5xl mx-auto px-4 -mt-10">

        {viewMode === 'scenario' ? (
          /* FUN MODE MODAL - CLEAN DARK UI WITH HQ BACKGROUND */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center px-4"
            onClick={() => setViewMode('home')}
          >
            {/* Background with HQ Image */}
            <div className="absolute inset-0 bg-black">
              <img src="/hq-bg.png" className="absolute inset-0 w-full h-full object-cover opacity-70" />
              <div className="absolute inset-0 bg-gradient-to-b from-blue-900/40 via-blue-950/30 to-black/70" />
              <div className="absolute inset-0 backdrop-blur-lg" />
            </div>

            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-blue-900/30 border border-cyan-400/30 backdrop-blur-2xl rounded-3xl shadow-[0_0_100px_rgba(96,165,250,0.4)] overflow-hidden relative p-12 z-10"
            >
              {/* Close Button */}
              <button
                onClick={() => setViewMode('home')}
                className="absolute top-6 right-6 w-10 h-10 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-200/70 hover:text-cyan-100 transition-all"
              >
                <span className="text-2xl leading-none">×</span>
              </button>

              {/* Header */}
              <div className="mb-10">
                <div className="flex items-center gap-3 mb-3">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-sm font-bold tracking-[0.3em] uppercase text-cyan-300/80">Fun Mode</h2>
                </div>
                <h1 className="text-4xl font-black text-white mb-2">What's on your mind?</h1>
                <p className="text-blue-200/80 text-base">Watch your emotions discuss it live</p>
              </div>

              {/* Topic Input */}
              <div className="mb-8">
                <label className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3 block">Topic</label>
                <textarea
                  id="scenario-topic"
                  placeholder="Type something or pick a suggestion..."
                  className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 text-2xl font-semibold text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-all resize-none min-h-[120px] leading-tight"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      const topic = e.target.value
                      const mode = document.querySelector('input[name="intensity"]:checked')?.value || 'short'
                      if (topic.trim()) startFunMode(topic, mode)
                    }
                  }}
                />
              </div>

              {/* Suggestions */}
              <div className="mb-8">
                <label className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3 block">Suggestions</label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { text: "Tomorrow is Monday", icon: "📅" },
                    { text: "Pineapple on pizza?", icon: "🍕" },
                    { text: "Go to a new city?", icon: "✈️" }
                  ].map(({ text, icon }) => (
                    <button
                      key={text}
                      onClick={() => {
                        // Auto-submit with 'short' mode
                        startFunMode(text, 'short')
                      }}
                      className="group relative w-full text-left px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{icon}</span>
                        <span className="font-medium text-white/80 group-hover:text-white">{text}</span>
                        <ArrowRight className="ml-auto w-4 h-4 text-white/30 group-hover:text-white/80 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration Options */}
              <div className="mb-10">
                <label className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3 block">Duration</label>
                <div className="flex bg-black/30 backdrop-blur-sm p-1.5 rounded-xl w-full border border-white/10">
                  {[
                    { mode: 'short', label: 'Brief' },
                    { mode: 'medium', label: 'Balanced' },
                    { mode: 'long', label: 'Extended' }
                  ].map(({ mode, label }) => (
                    <label key={mode} className="flex-1 cursor-pointer">
                      <input type="radio" name="intensity" value={mode} className="peer hidden" defaultChecked={mode === 'short'} />
                      <div className="py-2.5 text-center rounded-lg text-sm font-bold text-white/40 peer-checked:bg-white/10 peer-checked:text-white transition-all">
                        {label}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={() => {
                  const topic = document.getElementById('scenario-topic').value
                  const mode = document.querySelector('input[name="intensity"]:checked')?.value || 'short'
                  if (topic.trim()) startFunMode(topic, mode)
                  else document.getElementById('scenario-topic').focus()
                }}
                className="w-full py-4 rounded-xl bg-cyan-500 text-white font-black tracking-wider hover:bg-cyan-600 transition-all shadow-lg shadow-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/40 flex items-center justify-center gap-3"
              >
                <span>START</span>
                <Play className="w-5 h-5 fill-current" />
              </button>
            </motion.div>
          </motion.div>
        ) : (
          /* REGULAR HOME VIEW - CENTERED COMMAND CENTER */
          <div className="flex-1 w-full flex flex-col items-center justify-center relative z-20 pb-20">

            {/* CORE UNIT: Hero + Agents (Grouped to move together) */}
            <div className="flex flex-col items-center space-y-5 mb-10 w-full -mt-32">

              {/* 1. HERO VISUAL */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activePersona.name}
                  initial={{ scale: 0.9, opacity: 0, filter: "blur(20px)" }}
                  animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                  exit={{ scale: 1.1, opacity: 0, filter: "blur(20px)" }}
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
                  className="relative flex flex-col items-center"
                >
                  <div className={`absolute inset-0 bg-gradient-to-r ${activePersona.color} blur-[120px] opacity-20 animate-pulse`} />

                  {activePersona.name === 'Headquarters' ? (
                    <div className="relative flex items-center justify-center">
                      <motion.img
                        src={isProcessing ? "/hero-characters.png" : "/logo.png"}
                        className="w-full max-w-[500px] md:max-w-[800px] h-auto object-contain drop-shadow-[0_0_80px_rgba(255,255,255,0.2)]"
                        animate={{ y: [0, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
                      />
                    </div>
                  ) : (
                    <div className="relative group">
                      {/* Core Orb Container */}
                      <div className="relative">
                        {(isPlaying) && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            {[1, 2, 3].map((i) => (
                              <motion.div
                                key={i}
                                className={`absolute inset-0 rounded-full border border-white/20`}
                                initial={{ scale: 1, opacity: 0.8 }}
                                animate={{ scale: 1.8 + (i * 0.3), opacity: 0 }}
                                transition={{ repeat: Infinity, duration: 2, delay: i * 0.5, ease: "easeOut" }}
                              />
                            ))}
                          </div>
                        )}

                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          className={`w-32 h-32 md:w-48 md:h-48 rounded-full bg-gradient-to-br ${activePersona.color} flex items-center justify-center shadow-[0_0_60px_rgba(255,255,255,0.1)] relative overflow-hidden ring-2 ring-white/10 ring-offset-[10px] ring-offset-transparent backdrop-blur-md`}
                        >
                          <div className="text-white drop-shadow-2xl transform scale-[1.8] relative z-10">
                            {activePersona.icon}
                          </div>
                        </motion.div>
                      </div>

                      {/* Name Badge - Always visible */}
                      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mt-8 flex flex-col items-center gap-1">
                        <div className="px-6 py-1.5 rounded-full border border-white/10 bg-black/60 backdrop-blur-2xl text-sm md:text-base font-bold tracking-[0.3em] uppercase text-white shadow-2xl">
                          {activePersona.name}
                        </div>
                        <div className="text-[10px] text-white/40 tracking-[0.2em] uppercase font-bold">
                          {activePersona.vibe}
                        </div>
                      </motion.div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* 2. ENLARGED COMMAND DECK - Floating below Hero */}
              {!isProcessing && (
                <div className="flex flex-col items-center gap-4 group mt-4">
                  <div className="flex gap-4 md:gap-8 justify-center items-center px-12 py-6 rounded-[3rem] bg-neutral-900/80 border border-white/20 backdrop-blur-3xl shadow-[0_30px_80px_rgba(0,0,0,0.9)] transition-all hover:bg-neutral-900/90 border-t-white/30 ring-1 ring-white/5">
                    {PERSONAS.filter(p => p.name !== "Headquarters").map(p => {
                      const isSelected = selectedPersonas.includes(p.name)
                      return (
                        <button
                          key={p.name}
                          onClick={() => {
                            if (isSelected) setSelectedPersonas(prev => prev.filter(n => n !== p.name))
                            else setSelectedPersonas(prev => [...prev, p.name])
                          }}
                          className={`relative w-16 h-16 md:w-24 md:h-24 rounded-full transition-all duration-500 flex items-center justify-center group/btn ${isSelected ? 'scale-110 ring-4 ring-white/30 z-10' : 'scale-90 opacity-20 hover:opacity-100 grayscale hover:grayscale-0'}`}
                        >
                          <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${p.color} blur-2xl opacity-0 group-hover/btn:opacity-60 transition-opacity`} />
                          <div className={`relative z-10 w-full h-full rounded-full bg-gradient-to-br ${p.color} flex items-center justify-center text-white shadow-2xl border-2 border-white/20 hover:border-white/50 transition-all`}>
                            <div className="transform scale-[2] md:scale-[2.5]">
                              {p.icon}
                            </div>
                          </div>
                          {/* Name Label - Always Visible */}
                          <div className="absolute -top-14 opacity-100 transition-all pointer-events-none scale-100">
                            <span className="bg-black/90 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-white border border-white/20 shadow-xl">
                              {p.name}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                    <div className="w-[1px] h-20 bg-white/10 mx-2" />
                    <button
                      onClick={() => setSelectedPersonas(PERSONAS.filter(p => p.name !== 'Headquarters').map(p => p.name))}
                      className="w-14 h-14 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-white/30 hover:text-white hover:bg-white/10 transition-all text-3xl" title="Reset All"
                    >
                      ↺
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* 3. CAPTION / CAPTION AREA - Cinematic floating captions */}
            <div className="absolute bottom-64 w-full text-center min-h-[120px] flex flex-col items-center justify-center max-w-4xl px-8 pointer-events-none">

              {/* AI Response / Captions */}
              <AnimatePresence mode="wait">
                {lastMessage && (
                  <motion.div
                    key={lastMessage.text}
                    initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
                    className="flex flex-col items-center gap-4"
                  >
                    {lastMessage.role === 'ai' && (
                      <div className="flex flex-col items-center gap-2">
                        <div className={`h-1 w-12 rounded-full bg-gradient-to-r ${activePersona.color} shadow-[0_0_15px_rgba(255,255,255,0.5)]`} />
                        {/* Redundant name removed to prevent overlap */}
                      </div>
                    )}
                    <h2 className="text-2xl md:text-3xl lg:text-4xl font-medium leading-[1.2] tracking-tight text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] max-w-3xl">
                      {lastMessage.text}
                    </h2>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Live User Input - Secondary focus */}
              <div className="mt-6">
                <AnimatePresence>
                  {isUserSpeaking && callActiveState && !showInput && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <div className="text-xl md:text-2xl text-white/40 font-light italic leading-relaxed">
                        "{inputText || '...'}"
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>


          </div>
        )}
      </main>

      {/* FIXED TOP TOOLS */}
      <div className="fixed top-8 right-8 z-50">
        {isProcessing && abortDebateRef.current === false ? (
          <button onClick={stopDebate} className="flex items-center gap-4 px-8 py-4 rounded-full bg-red-600 hover:bg-red-700 text-white font-black shadow-2xl transition-all border border-red-400/50 backdrop-blur-xl group">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse group-hover:scale-125 transition-transform" />
            <span className="tracking-[0.2em] text-sm">STOP FUN MODE</span>
          </button>
        ) : (
          <div className="relative">
            {/* CONFIG / JUDGE MODE BUTTON */}
            <button onClick={(e) => { e.stopPropagation(); setShowConfig(true); }} className="absolute right-20 top-0 w-14 h-14 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-xl border border-white/10 hover:bg-white/10 text-white/40 hover:text-white transition-all shadow-2xl z-50" title="Judge Settings">
              <Lock className="w-5 h-5" />
            </button>

            {/* FUN MODE BUTTON (Existing) */}
            <button onClick={() => setViewMode('scenario')} className="w-14 h-14 rounded-full flex items-center justify-center bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 text-white/40 hover:text-white transition-all shadow-2xl group relative z-50" title="Fun Mode">
              <SlidersHorizontal className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
            </button>

            {/* PROMO ARROW - Pointing to Fun Mode */}
            <motion.div
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 1 }}
              className="absolute top-16 right-[-34px] flex flex-col items-center pointer-events-none w-32"
            >
              <div className="text-[10px] font-black tracking-widest text-yellow-400 mb-1 animate-pulse">TRY FUN MODE</div>
              <svg className="w-6 h-6 text-yellow-500 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>
            </motion.div>
          </div>
        )}
      </div>

      {/* JUDGE CONFIG MODAL - Auto-shows if no keys detected */}
      <AnimatePresence>
        {showConfig && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-lg p-4"
            onClick={() => !keyStatus.loading && setShowConfig(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-neutral-900 border border-white/10 p-8 rounded-3xl w-full max-w-lg shadow-2xl relative"
            >
              {/* Header */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-3 mb-2">
                  <Lock className="w-6 h-6 text-yellow-500" />
                  API Configuration
                </h2>
                {!keysDetected && (
                  <div className="mt-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                    <p className="text-sm text-yellow-200/90 leading-relaxed">
                      <span className="font-bold">No API keys detected.</span> You can either:
                    </p>
                    <ul className="text-xs text-yellow-200/70 mt-2 space-y-1 ml-4 list-disc">
                      <li>Add keys to your <code className="bg-black/30 px-1.5 py-0.5 rounded">.env</code> file and restart, OR</li>
                      <li>Enter them below for this session (stored locally)</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Input Fields */}
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">
                    Gemini API Key
                  </label>
                  <input
                    type="password"
                    value={apiKeys.gemini}
                    onChange={e => {
                      setApiKeys({ ...apiKeys, gemini: e.target.value })
                      setKeyStatus({ loading: false, error: null, success: false })
                    }}
                    placeholder="AIzaSy..."
                    disabled={keyStatus.loading}
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white placeholder-white/20 focus:outline-none focus:border-yellow-500/50 disabled:opacity-50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">
                    ElevenLabs API Key
                  </label>
                  <input
                    type="password"
                    value={apiKeys.eleven}
                    onChange={e => {
                      setApiKeys({ ...apiKeys, eleven: e.target.value })
                      setKeyStatus({ loading: false, error: null, success: false })
                    }}
                    placeholder="sk_..."
                    disabled={keyStatus.loading}
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white placeholder-white/20 focus:outline-none focus:border-yellow-500/50 disabled:opacity-50 transition-all"
                  />
                </div>

                {/* Status Messages */}
                <AnimatePresence mode="wait">
                  {keyStatus.error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-sm"
                    >
                      {keyStatus.error}
                    </motion.div>
                  )}
                  {keyStatus.success && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-200 text-sm flex items-center gap-2"
                    >
                      <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      Keys validated! Connecting...
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => setShowConfig(false)}
                    disabled={keyStatus.loading}
                    className="flex-1 py-3 rounded-xl font-bold hover:bg-white/5 transition-all disabled:opacity-50"
                  >
                    {keysDetected ? 'Close' : 'Skip'}
                  </button>
                  <button
                    onClick={handleSaveKeys}
                    disabled={keyStatus.loading || (!apiKeys.gemini && !apiKeys.eleven)}
                    className="flex-1 py-3 rounded-xl bg-yellow-500 text-black font-bold hover:bg-yellow-400 transition-all shadow-lg shadow-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {keyStatus.loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        Validating...
                      </>
                    ) : (
                      'Save & Connect'
                    )}
                  </button>
                </div>
                <p className="text-xs text-center text-white/20">
                  Keys are stored locally in your browser and sent to the backend for API calls.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FIXED BOTTOM CONSOLE */}
      {
        viewMode === 'home' && (
          <div className="fixed bottom-12 left-0 right-0 z-50 flex justify-center px-6">
            <div className="w-full max-w-4xl relative group">
              <div className={`absolute -inset-1 rounded-full bg-gradient-to-r ${activePersona.color} opacity-0 group-focus-within:opacity-20 blur-xl transition-all duration-1000`} />

              <div className="relative w-full bg-black/80 backdrop-blur-3xl border border-white/10 rounded-full flex items-center shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden">

                <input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend(inputText)}
                  placeholder={`Direct message to ${activePersona.name === 'Headquarters' ? 'Headquarters' : activePersona.name}...`}
                  className="flex-1 bg-white/10 h-[70px] md:h-[90px] px-10 text-xl text-white placeholder-white/40 focus:outline-none font-light tracking-wide rounded-l-full"
                />

                <div className="flex items-center gap-4 pr-6">
                  <AnimatePresence>
                    {inputText && (
                      <motion.button
                        initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                        onClick={() => handleSend(inputText)}
                        className="p-3 rounded-full bg-white/10 hover:bg-white text-white hover:text-black transition-all"
                      >
                        <Send className="w-5 h-5" />
                      </motion.button>
                    )}
                  </AnimatePresence>

                  <button
                    onClick={toggleCall}
                    className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300
                        ${callActiveState
                        ? 'bg-red-600 text-white shadow-[0_0_30px_rgba(220,38,38,0.5)] animate-pulse'
                        : 'bg-white/5 text-white/30 hover:bg-white/10 hover:text-white'
                      }
                      `}
                  >
                    {callActiveState ? <PhoneOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}

export default App;
