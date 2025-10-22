import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { DiagnosticReport, PossibleCause, RecommendedSolution, HistoryEntry, DTCCodeMeaning } from './types';
import { getCarDiagnostic, getDTCMeaning } from './services/geminiService';
import { connectToOBD, sendCommand, parseDTCs } from './services/obdService';
import DiagnosticCard from './components/DiagnosticCard';
import Loader from './components/Loader';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import { WrenchIcon, LightBulbIcon, CheckCircleIcon, CurrencyDollarIcon, BluetoothIcon, CodeIcon, HistoryIcon, MicrophoneIcon, SpeakerWaveIcon, StopCircleIcon } from './components/Icons';

// FIX: Define types for Web Bluetooth API
type BluetoothDevice = any;
type BluetoothRemoteGATTCharacteristic = any;
interface OBDConnection {
    device: BluetoothDevice;
    tx: BluetoothRemoteGATTCharacteristic;
    rx: BluetoothRemoteGATTCharacteristic;
}

// Reusable Components
const getTagColor = (level: 'High' | 'Medium' | 'Low' | 'Hard' | 'Moderate' | 'Easy'): string => {
    switch (level) {
      case 'High': case 'Hard': return 'bg-red-500 text-red-100';
      case 'Medium': case 'Moderate': return 'bg-yellow-500 text-yellow-100';
      case 'Low': case 'Easy': return 'bg-green-500 text-green-100';
      default: return 'bg-gray-500 text-gray-100';
    }
};

const DiagnosticResults: React.FC<{ report: DiagnosticReport }> = ({ report }) => {
    const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

    useEffect(() => {
        // Cancel speech synthesis on component unmount
        return () => {
            if (window.speechSynthesis?.speaking) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    const handleReadAloud = () => {
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
            return;
        }

        const causesText = "Possible causes include: " + report.possible_causes.map(c => `with ${c.likelihood} likelihood, ${c.cause}`).join('... ');
        const solutionsText = "Recommended solutions are: " + report.recommended_solutions.map(s => `${s.solution}, which is considered ${s.difficulty} to perform`).join('... ');
        const costText = `The estimated cost is ${report.estimated_cost}.`;
        const fullText = `${causesText}. ${solutionsText}. ${costText}`;

        const utterance = new SpeechSynthesisUtterance(fullText);
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => {
            console.error("SpeechSynthesis Error");
            setIsSpeaking(false);
        };
        window.speechSynthesis.speak(utterance);
    };

    return (
        <div className="w-full animate-fade-in space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-slate-100">Diagnostic Report</h2>
                <button 
                    onClick={handleReadAloud}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors text-white"
                    aria-label={isSpeaking ? "Stop reading aloud" : "Read report aloud"}
                >
                    {isSpeaking ? <StopCircleIcon className="w-6 h-6 text-red-400" /> : <SpeakerWaveIcon className="w-6 h-6 text-cyan-300" />}
                    <span className="font-semibold hidden sm:inline">{isSpeaking ? 'Stop Reading' : 'Read Aloud'}</span>
                </button>
            </div>
            <div className="space-y-8">
                <section>
                    <h3 className="text-2xl font-bold text-cyan-300 mb-4 flex items-center gap-2"><LightBulbIcon className="w-6 h-6"/>Possible Causes</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {report.possible_causes.map((item: PossibleCause, index: number) => <DiagnosticCard key={index} title={item.cause} tagText={item.likelihood} tagColor={getTagColor(item.likelihood)} />)}
                    </div>
                </section>
                <section>
                    <h3 className="text-2xl font-bold text-cyan-300 mb-4 flex items-center gap-2"><CheckCircleIcon className="w-6 h-6"/>Recommended Solutions</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {report.recommended_solutions.map((item: RecommendedSolution, index: number) => <DiagnosticCard key={index} title={item.solution} tagText={item.difficulty} tagColor={getTagColor(item.difficulty)} />)}
                    </div>
                </section>
                <section>
                    <h3 className="text-2xl font-bold text-cyan-300 mb-4 flex items-center gap-2"><CurrencyDollarIcon className="w-6 h-6"/>Estimated Cost</h3>
                    <div className="bg-slate-800 rounded-lg p-6 shadow-lg"><p className="text-3xl font-bold text-center text-white tracking-wider">{report.estimated_cost}</p></div>
                </section>
            </div>
        </div>
    );
}

// Page Components
const Dashboard: React.FC<{ onNewReport: (entry: HistoryEntry) => void }> = ({ onNewReport }) => {
    const [problem, setProblem] = useState<string>('');
    const [report, setReport] = useState<DiagnosticReport | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [obdConnection, setObdConnection] = useState<OBDConnection | null>(null);
    const [isConnecting, setIsConnecting] = useState<boolean>(false);
    const [isReading, setIsReading] = useState<boolean>(false);
    const [isListening, setIsListening] = useState<boolean>(false);
    const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState<boolean>(false);
    const recognitionRef = useRef<any>(null);
    const obdError = error && (error.startsWith('Bluetooth') || error.startsWith('OBD-II') || error.startsWith('Microphone'));
    const decoder = new TextDecoder();
    const fullResponse = useRef('');

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            setSpeechRecognitionSupported(true);
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;

            recognition.onresult = (event: any) => {
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    }
                }
                if (finalTranscript) {
                    setProblem(prev => (prev ? `${prev} ${finalTranscript}` : finalTranscript).trim());
                }
            };

            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);
            recognition.onerror = (event: any) => {
                console.error('Speech recognition error', event.error);
                if (event.error === 'not-allowed') {
                    setError("Microphone access was denied. Please allow microphone access in your browser settings.");
                }
                setIsListening(false);
            };
            recognitionRef.current = recognition;
        }
    }, []);

    const handleMicClick = () => {
        if (!speechRecognitionSupported) {
            setError("Speech recognition is not supported by your browser.");
            return;
        }
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
        }
    };

    const handleData = (event: Event) => {
        const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
        if (!value) return;
        fullResponse.current += decoder.decode(value);
        if (fullResponse.current.includes('>')) {
            const codes = parseDTCs(fullResponse.current);
            setProblem(codes.length > 0 ? `OBD-II Fault Codes Found: ${codes.join(', ')}.` : 'No fault codes found on the vehicle.');
            setIsReading(false);
            fullResponse.current = '';
        }
    };
    
    const handleConnect = async () => {
        setIsConnecting(true); setError(null); setReport(null);
        try {
            const connection = await connectToOBD();
            await connection.rx.startNotifications();
            connection.rx.addEventListener('characteristicvaluechanged', handleData);
            connection.device.addEventListener('gattserverdisconnected', () => setObdConnection(null));
            setObdConnection(connection);
        } catch (err) { setError(err instanceof Error ? err.message : 'An unknown error occurred.'); } 
        finally { setIsConnecting(false); }
    };

    const handleDisconnect = () => obdConnection?.device.gatt?.disconnect();
    const handleReadCodes = async () => {
        if (!obdConnection) return;
        setIsReading(true); setError(null); setReport(null); fullResponse.current = '';
        try {
            await sendCommand(obdConnection.tx, '0100');
            await new Promise(resolve => setTimeout(resolve, 100));
            await sendCommand(obdConnection.tx, '03');
        } catch (err) { setError(err instanceof Error ? err.message : 'An unknown error occurred.'); setIsReading(false); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!problem.trim()) { setError('Please describe the car problem or read codes from scanner.'); return; }
        setIsLoading(true); setError(null); setReport(null);
        try {
            const diagnosticReport = await getCarDiagnostic(problem);
            setReport(diagnosticReport);
            onNewReport({ id: new Date().toISOString(), timestamp: new Date().toLocaleString(), query: problem, report: diagnosticReport });
        } catch (err) { setError(err instanceof Error ? err.message : 'An unknown error occurred.'); } 
        finally { setIsLoading(false); }
    };
    
    return (
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-8">
            <header className="text-center">
                <div className="flex justify-center items-center gap-3 mb-2">
                    <WrenchIcon className="w-10 h-10 text-cyan-400"/>
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">TM Car Diagnostics</h1>
                </div>
                <p className="text-slate-400">Use your OBD-II scanner or describe the issue to get an instant AI-powered diagnosis.</p>
            </header>
            <div className="w-full max-w-2xl text-center p-6 rounded-xl bg-slate-800/50 border border-slate-700 space-y-4">
                <h2 className="text-xl font-bold text-slate-200 flex items-center justify-center gap-2"><BluetoothIcon className="w-6 h-6" />OBD-II Scanner</h2>
                {!obdConnection ? (
                    <div>
                        <p className="text-slate-400 mb-4">Connect to your scanner to read fault codes directly.</p>
                        <button onClick={handleConnect} disabled={isConnecting} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait">{isConnecting ? 'Connecting...' : 'Connect'}</button>
                    </div>
                ) : (
                    <div className="space-y-4">
                         <p className="text-green-400 font-medium">Connected to: {obdConnection.device.name}</p>
                         <div className="flex justify-center gap-4">
                            <button onClick={handleReadCodes} disabled={isReading} className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait">{isReading ? 'Reading...' : 'Read Codes'}</button>
                            <button onClick={handleDisconnect} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Disconnect</button>
                         </div>
                    </div>
                )}
                {obdError && <p className="text-red-400 mt-2">{error}</p>}
            </div>
            <div className="text-slate-400 font-semibold text-lg">OR</div>
            <form onSubmit={handleSubmit} className="w-full max-w-2xl bg-slate-800/50 p-6 rounded-xl shadow-2xl border border-slate-700">
                <label htmlFor="problem-description" className="block text-lg font-medium text-slate-300 mb-2">Describe the problem manually</label>
                <div className="relative w-full">
                    <textarea id="problem-description" value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="e.g., 'Loud grinding noise when turning left...' or press the mic to speak" className="w-full h-32 p-3 pr-14 bg-slate-900 border-2 border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all" disabled={isLoading} />
                    {speechRecognitionSupported && (
                        <button type="button" onClick={handleMicClick} className={`absolute right-3 top-3 p-2 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`} aria-label={isListening ? 'Stop listening' : 'Start listening'}>
                            <MicrophoneIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
                <button type="submit" disabled={isLoading || isConnecting || isReading || isListening} className="mt-4 w-full flex justify-center items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 transition-all transform hover:scale-105">{isLoading ? 'Diagnosing...' : 'Get Diagnosis'}</button>
            </form>
            <div className="w-full max-w-5xl mt-6 flex justify-center">
                {isLoading && <Loader />}
                {error && !obdError && <div className="text-red-400 bg-red-900/50 p-4 rounded-lg border border-red-700 animate-fade-in">{error}</div>}
                {report && <DiagnosticResults report={report} />}
            </div>
        </div>
    );
};

const CodeMeanings: React.FC = () => {
    const [code, setCode] = useState<string>('');
    const [result, setResult] = useState<DTCCodeMeaning | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code.trim().match(/^[PBUC][0-9A-F]{4}$/i)) { setError('Please enter a valid DTC code (e.g., P0300).'); return; }
        setIsLoading(true); setError(null); setResult(null);
        try {
            const meaning = await getDTCMeaning(code.trim().toUpperCase());
            setResult(meaning);
        } catch (err) { setError(err instanceof Error ? err.message : 'An unknown error occurred.'); } 
        finally { setIsLoading(false); }
    };
    
    return (
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-8 animate-fade-in">
             <header className="text-center">
                <div className="flex justify-center items-center gap-3 mb-2">
                    <CodeIcon className="w-10 h-10 text-cyan-400"/>
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">DTC Code Meanings</h1>
                </div>
                <p className="text-slate-400">Enter an OBD-II code to get a detailed explanation.</p>
            </header>
            <form onSubmit={handleSubmit} className="w-full max-w-md bg-slate-800/50 p-6 rounded-xl shadow-2xl border border-slate-700">
                <label htmlFor="code-input" className="block text-lg font-medium text-slate-300 mb-2">Enter Fault Code</label>
                <input id="code-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g., P0300" className="w-full p-3 bg-slate-900 border-2 border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 uppercase" disabled={isLoading} />
                <button type="submit" disabled={isLoading} className="mt-4 w-full flex justify-center items-center gap-2 bg-cyan-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-cyan-600 disabled:opacity-50">{isLoading ? 'Searching...' : 'Search Code'}</button>
            </form>
             <div className="w-full max-w-3xl mt-6 flex justify-center">
                {isLoading && <Loader />}
                {error && <div className="text-red-400 bg-red-900/50 p-4 rounded-lg border border-red-700 animate-fade-in">{error}</div>}
                {result && (
                    <div className="w-full bg-slate-800 rounded-lg p-6 space-y-4 animate-fade-in">
                        <h2 className="text-2xl font-bold text-cyan-300">{result.code}: {result.title}</h2>
                        <p className="text-slate-300">{result.description}</p>
                        <div>
                            <h3 className="font-semibold text-slate-200 mb-2">Common Symptoms:</h3>
                            <ul className="list-disc list-inside text-slate-400 space-y-1">
                                {result.common_symptoms.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-200 mb-2">Possible Causes:</h3>
                            <ul className="list-disc list-inside text-slate-400 space-y-1">
                                {result.possible_causes.map((c, i) => <li key={i}>{c}</li>)}
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const History: React.FC<{ history: HistoryEntry[]; clearHistory: () => void }> = ({ history, clearHistory }) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    return (
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-8 animate-fade-in">
            <header className="w-full flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <HistoryIcon className="w-10 h-10 text-cyan-400"/>
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">History</h1>
                </div>
                {history.length > 0 && <button onClick={clearHistory} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Clear History</button>}
            </header>
            <div className="w-full space-y-4">
                {history.length === 0 ? <p className="text-slate-400 text-center">No diagnostic history found.</p> :
                 history.map(entry => (
                    <div key={entry.id} className="bg-slate-800/50 border border-slate-700 rounded-lg">
                        <button onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)} className="w-full text-left p-4 hover:bg-slate-700/50">
                            <p className="font-semibold text-slate-200 truncate">Query: "{entry.query}"</p>
                            <p className="text-sm text-slate-400">{entry.timestamp}</p>
                        </button>
                        {expandedId === entry.id && <div className="p-4 border-t border-slate-700"><DiagnosticResults report={entry.report} /></div>}
                    </div>
                ))}
            </div>
        </div>
    );
};


// Main App Component
const App: React.FC = () => {
    const [activeView, setActiveView] = useState<'dashboard' | 'codes' | 'history'>('dashboard');
    const [history, setHistory] = useState<HistoryEntry[]>([]);

    useEffect(() => {
        try {
            const storedHistory = localStorage.getItem('diagnosticHistory');
            if (storedHistory) setHistory(JSON.parse(storedHistory));
        } catch (error) { console.error("Failed to load history", error); }
    }, []);

    const updateHistory = (newEntry: HistoryEntry) => {
        setHistory(prev => {
            const updated = [newEntry, ...prev];
            try { localStorage.setItem('diagnosticHistory', JSON.stringify(updated)); } catch (e) { console.error("Failed to save history", e); }
            return updated;
        });
    };
    
    const clearHistory = () => {
        if(window.confirm("Are you sure you want to clear all history?")) {
            setHistory([]);
            try { localStorage.removeItem('diagnosticHistory'); } catch (e) { console.error("Failed to clear history", e); }
        }
    };
    
    const renderView = () => {
        switch (activeView) {
            case 'codes': return <CodeMeanings />;
            case 'history': return <History history={history} clearHistory={clearHistory} />;
            default: return <Dashboard onNewReport={updateHistory} />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
            <style>{`@keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }`}</style>
            <Sidebar activeView={activeView} setActiveView={setActiveView} />
            <main className="flex-1 sm:ml-64 p-4 sm:p-6 lg:p-8 pb-24 sm:pb-6">
                {renderView()}
            </main>
            <BottomNav activeView={activeView} setActiveView={setActiveView} />
        </div>
    );
};

export default App;
