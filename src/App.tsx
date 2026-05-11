/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Loader2, BookOpen, PenTool, Layout, ChevronRight, User as UserIcon, LogOut, CheckCircle2, History, Zap, Moon, Sun, Compass, Share2 } from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { auth, db, googleProvider, OperationType, handleFirestoreError } from './firebase';
import { generateStudyMaterial, analyzeTopic, StudyAnalysis } from './services/gemini';
import FileUploader from './components/FileUploader';
import StudySheet from './components/StudySheet';
import { cn } from './lib/utils';

type Step = 'input' | 'analysis' | 'selection' | 'generating' | 'result' | 'history' | 'explore';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [step, setStep] = useState<Step>('input');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currentSheetId, setCurrentSheetId] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [analysis, setAnalysis] = useState<StudyAnalysis | null>(null);
  const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
  const [detailLevel, setDetailLevel] = useState('standard');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPages, setGeneratedPages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [exploreSheets, setExploreSheets] = useState<any[]>([]);
  const [isExploreLoading, setIsExploreLoading] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    // Deep linking support
    const params = new URLSearchParams(window.location.search);
    const viewId = params.get('v');
    if (viewId) {
      loadSingleSheet(viewId);
    }
  }, []);

  const loadSingleSheet = async (id: string) => {
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const docRef = doc(db, 'studySheets', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGeneratedPages(data.pages);
        setTopic(data.topic);
        setCurrentSheetId(id);
        setStep('result');
      }
    } catch (err) {
      console.error("Error loading single sheet:", err);
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    if (!isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) loadHistory(u.uid);
    });
  }, []);

  const loadHistory = async (uid: string) => {
    try {
      const q = query(
        collection(db, 'studySheets'),
        where('userId', '==', uid),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error("History load error:", err);
    }
  };

  const loadExplore = async () => {
    setIsExploreLoading(true);
    setStep('explore');
    try {
      const q = query(
        collection(db, 'studySheets'),
        orderBy('createdAt', 'desc'),
        limit(24)
      );
      const snapshot = await getDocs(q);
      setExploreSheets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error("Explore load error:", err);
    } finally {
      setIsExploreLoading(false);
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleStartAnalysis = async () => {
    if (!topic && files.length === 0) {
      setError('Zadejte prosím téma nebo nahrajte soubory.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const fileData = await Promise.all(
        files.map(async (file) => ({
          data: await readFileAsBase64(file),
          mimeType: file.type || 'application/octet-stream',
        }))
      );

      const result = await analyzeTopic(topic, fileData);
      setAnalysis(result);
      setSelectedSubtopics(result.subtopics);
      setStep('selection');
    } catch (err) {
      setError('Nepodařilo se analyzovat téma. Zkuste to znovu.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerate = async () => {
    setStep('generating');
    setIsGenerating(true);

    try {
      const fileData = await Promise.all(
        files.map(async (file) => ({
          data: await readFileAsBase64(file),
          mimeType: file.type || 'application/octet-stream',
        }))
      );

      const pages = await generateStudyMaterial(topic, selectedSubtopics, detailLevel, fileData);
      setGeneratedPages(pages);
      setStep('result');

      if (user) {
        const docData = {
          userId: user.uid,
          topic,
          detailLevel,
          selectedSubtopics,
          pages,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        try {
          const docRef = await addDoc(collection(db, 'studySheets'), docData);
          setCurrentSheetId(docRef.id);
          loadHistory(user.uid);
        } catch (dbErr) {
          handleFirestoreError(dbErr, OperationType.CREATE, 'studySheets');
        }
      }
    } catch (err) {
      setError('Generování selhalo. Zkuste to znovu.');
      setStep('selection');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLogin = () => signInWithPopup(auth, googleProvider);
  const handleLogout = () => signOut(auth);

  const resetAll = () => {
    setStep('input');
    setTopic('');
    setFiles([]);
    setAnalysis(null);
    setGeneratedPages([]);
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-indigo-50/50 dark:bg-slate-950 transition-colors duration-300">
      {/* Header */}
      <nav className="bg-white dark:bg-slate-900 border-b-2 border-indigo-100 dark:border-slate-800 sticky top-0 z-50 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-18 items-center">
            <div className="flex items-center gap-3 cursor-pointer" onClick={resetAll}>
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                <Zap className="w-6 h-6 fill-current" />
              </div>
              <span className="text-2xl font-black text-indigo-900 dark:text-white tracking-tight">
                Shate
              </span>
            </div>
            
            <div className="flex items-center gap-4 sm:gap-6">
              <button 
                onClick={toggleDarkMode}
                className="p-2.5 rounded-xl bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors"
                title="Přepnout tmavý režim"
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <button 
                onClick={loadExplore}
                className={cn(
                  "flex items-center gap-2 text-sm font-bold transition-colors",
                  step === 'explore' ? "text-indigo-600" : "text-indigo-900/60 dark:text-white/60 hover:text-indigo-900 dark:hover:text-white"
                )}
              >
                <Compass className="w-5 h-5" />
                <span className="hidden sm:inline">Prozkoumat</span>
              </button>

              {user && (
                <button 
                  onClick={() => setStep('history')}
                  className={cn(
                    "flex items-center gap-2 text-sm font-bold transition-colors",
                    step === 'history' ? "text-indigo-600" : "text-indigo-900/60 dark:text-white/60 hover:text-indigo-900 dark:hover:text-white"
                  )}
                >
                  <History className="w-5 h-5" />
                  <span className="hidden sm:inline">Moje Listy</span>
                </button>
              )}
              
              {user ? (
                <div className="flex items-center gap-3 bg-indigo-50 dark:bg-slate-800 p-1.5 pr-4 rounded-full border border-indigo-100 dark:border-slate-700">
                  <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-600 shadow-sm" />
                  <span className="text-sm font-bold text-indigo-900 dark:text-white hidden sm:inline">{user.displayName}</span>
                  <button onClick={handleLogout} className="p-1 hover:text-red-500 transition-colors dark:text-slate-400">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleLogin}
                  className="bg-indigo-600 text-white text-sm font-black px-6 py-2.5 rounded-full hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                >
                  Přihlásit se
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow max-w-5xl mx-auto w-full px-4 py-8 sm:py-12 sm:px-6 lg:px-8 space-y-12">
        {/* Step 1: Input */}
        {step === 'input' && (
          <div className="space-y-12 animate-in">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-black uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                Vytvořeno pomocí Gemini AI
              </div>
              <h1 className="text-4xl sm:text-6xl font-black text-indigo-950 dark:text-white tracking-tight leading-tight">
                Proměňte své poznámky v <br className="hidden sm:block" />
                <span className="text-indigo-600">dokonalé učivo</span>
              </h1>
              <p className="text-lg text-indigo-900/60 dark:text-white/60 font-medium max-w-2xl mx-auto">
                Vložte téma nebo nahrajte fotky sešitu a PowerPointy. AI vám během pár sekund vytvoří přehledný studijní list s testíky.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8">
              <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl shadow-indigo-200/50 dark:shadow-none border-2 border-white dark:border-slate-800 p-6 sm:p-10 space-y-10">
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-indigo-950 dark:text-white flex items-center gap-2">
                    <span className="bg-indigo-100 dark:bg-indigo-900/30 p-1.5 rounded-xl">🚀</span>
                    Co dnes probereme?
                  </h2>
                  <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Zadej téma nebo zkopíruj text, který se chceš naučit... (např. Průmyslová revoluce, Buněčné dýchání...)"
                    className="w-full min-h-[160px] p-6 bg-indigo-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/20 transition-all outline-none text-indigo-900 dark:text-indigo-300 text-lg font-medium placeholder:text-indigo-300 dark:placeholder:text-indigo-900 resize-none"
                  />
                </div>

                <div className="space-y-4">
                  <FileUploader files={files} setFiles={setFiles} onRemove={(idx) => setFiles(f => f.filter((_, i) => i !== idx))} />
                </div>

                {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-2xl text-sm font-bold border-2 border-red-100 dark:border-red-900/30">{error}</div>}

                <button
                  onClick={handleStartAnalysis}
                  disabled={isGenerating}
                  className={cn(
                    "w-full py-5 rounded-2xl text-xl font-black flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xl shadow-indigo-200 dark:shadow-none",
                    isGenerating ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed" : "bg-indigo-600 text-white hover:bg-indigo-700"
                  )}
                >
                  {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : "POKRAČOVAT K ANALÝZE ✨"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Selection */}
        {step === 'selection' && analysis && (
          <div className="max-w-3xl mx-auto space-y-10 animate-in">
            <div className="text-center space-y-4">
              <h1 className="text-3xl font-black text-indigo-950 dark:text-white">Přizpůsobte si svůj list</h1>
              <p className="text-indigo-900/60 dark:text-white/60 font-medium">{analysis.suggestedFocus}</p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 sm:p-10 shadow-2xl dark:shadow-none border-2 border-white dark:border-slate-800 space-y-10">
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-indigo-950 dark:text-white">Vyberte podtémata pro pracovní list:</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {analysis.subtopics.map((st) => (
                    <button
                      key={st}
                      onClick={() => setSelectedSubtopics(prev => prev.includes(st) ? prev.filter(s => s !== st) : [...prev, st])}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left",
                        selectedSubtopics.includes(st) 
                          ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 text-indigo-900 dark:text-indigo-300" 
                          : "border-indigo-50 dark:border-slate-800 text-indigo-900/40 dark:text-white/40 hover:border-indigo-100"
                      )}
                    >
                      <div className={cn(
                        "w-6 h-6 rounded-lg flex items-center justify-center transition-colors border-2",
                        selectedSubtopics.includes(st) ? "bg-indigo-600 border-indigo-600 text-white" : "border-indigo-200 dark:border-slate-700"
                      )}>
                        {selectedSubtopics.includes(st) && <CheckCircle2 className="w-4 h-4" />}
                      </div>
                      <span className="font-bold">{st}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6 pt-4 border-t-2 border-indigo-50 dark:border-slate-800">
                <h2 className="text-lg font-bold text-indigo-950 dark:text-white">Úroveň detailů:</h2>
                <div className="flex gap-4">
                  {['simple', 'standard', 'detailed'].map((level) => (
                    <button
                      key={level}
                      onClick={() => setDetailLevel(level)}
                      className={cn(
                        "flex-1 py-4 px-2 rounded-2xl border-2 font-black text-sm uppercase tracking-wide transition-all",
                        detailLevel === level 
                          ? "bg-amber-400 border-amber-400 text-amber-950 shadow-lg shadow-amber-200" 
                          : "border-indigo-50 dark:border-slate-800 text-indigo-900/30 dark:text-white/30 hover:border-indigo-100"
                      )}
                    >
                      {level === 'simple' ? 'Stručné' : level === 'standard' ? 'Standard' : 'Detailní'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-6">
                <button 
                  onClick={() => setStep('input')}
                  className="flex-1 py-5 rounded-2xl bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-black hover:bg-indigo-100 transition-colors"
                >
                  ZPĚT
                </button>
                <button 
                  onClick={handleGenerate}
                  className="flex-[2] py-5 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 dark:shadow-none"
                >
                  VYGENEROVAT UČIVO ✨
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Explore Page */}
        {step === 'explore' && (
          <div className="space-y-12 animate-in duration-500">
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-black text-indigo-950 dark:text-white tracking-tight">Veřejná Knihovna</h1>
              <p className="text-indigo-900/60 dark:text-white/60 font-medium">Objevujte studijní materiály vytvořené komunitou Shate.</p>
            </div>

            {isExploreLoading ? (
              <div className="flex justify-center py-24">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {exploreSheets.map((sheet) => (
                  <div 
                    key={sheet.id}
                    onClick={() => { setGeneratedPages(sheet.pages); setTopic(sheet.topic); setCurrentSheetId(sheet.id); setStep('result'); }}
                    className="bg-white dark:bg-slate-900 p-6 rounded-3xl border-2 border-white dark:border-slate-800 shadow-xl dark:shadow-none hover:shadow-indigo-200 dark:hover:border-indigo-500/50 transition-all cursor-pointer group hover:-translate-y-1"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">📚</div>
                      <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-black rounded-full uppercase tracking-wider">Veřejné</span>
                    </div>
                    <h3 className="font-black text-indigo-950 dark:text-white line-clamp-2 min-h-[3rem] mb-2">{sheet.topic}</h3>
                    <div className="flex items-center justify-between text-[10px] font-bold text-indigo-900/40 dark:text-white/30 uppercase tracking-widest">
                      <span>{sheet.pages.length} STRAN</span>
                      <span>{sheet.createdAt?.toDate?.()?.toLocaleDateString('cs-CZ') || 'Nedávno'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Generating */}
        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center py-24 space-y-8 animate-in text-center">
             <div className="relative">
               <div className="w-24 h-24 border-8 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
               <Sparkles className="w-10 h-10 text-amber-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
             </div>
             <div className="space-y-2">
               <h1 className="text-2xl font-black text-indigo-950">Píšeme váš pracovní list...</h1>
               <p className="text-indigo-900/60 font-medium">Gemini AI analyzuje vaše požadavky a dává dohromady to nejlepší učivo.</p>
             </div>
          </div>
        )}

        {/* Step 4: Result */}
        {step === 'result' && (
          <div className="space-y-8 animate-in">
             <button 
               onClick={() => setStep('selection')}
               className="text-sm font-black text-indigo-900/40 hover:text-indigo-900 flex items-center gap-1 transition-colors print:hidden"
             >
               ← UPRAVIT NASTAVENÍ
             </button>
             <StudySheet pages={generatedPages} isVisible={true} topic={topic} id={currentSheetId} />
             
             {!user && (
               <div className="bg-amber-100 rounded-[32px] p-8 border-4 border-white shadow-xl shadow-amber-200/50 flex flex-col sm:flex-row items-center gap-6 print:hidden">
                 <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-sm">💎</div>
                 <div className="flex-grow text-center sm:text-left">
                   <h3 className="text-xl font-black text-amber-900">Chcete si tento list uložit navždy?</h3>
                   <p className="text-amber-800 font-medium">Přihlaste se a mějte své studijní materiály dostupné kdykoliv a kdekoliv.</p>
                 </div>
                 <button 
                   onClick={handleLogin}
                   className="whitespace-nowrap bg-indigo-900 text-white px-8 py-4 rounded-2xl font-black hover:bg-black transition-all"
                 >
                   PŘIHLÁSIT SE K SHATE
                 </button>
               </div>
             )}
          </div>
        )}

        {/* List History */}
        {step === 'history' && (
           <div className="space-y-8 animate-in">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <h1 className="text-3xl font-black text-indigo-950 tracking-tight">Moje Pracovní Listy</h1>
                  <p className="text-indigo-900/60 font-medium">Historie tvého vzdělávání</p>
                </div>
                <button 
                  onClick={resetAll}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all shadow-lg"
                >
                  VYTVOŘIT NOVÝ +
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {history.map((sheet) => (
                  <div 
                    key={sheet.id}
                    onClick={() => { setGeneratedPages(sheet.pages); setTopic(sheet.topic); setCurrentSheetId(sheet.id); setStep('result'); }}
                    className="bg-white p-6 rounded-3xl border-2 border-white shadow-xl shadow-indigo-100 dark:shadow-none hover:shadow-indigo-200 transition-all cursor-pointer group hover:-translate-y-1"
                  >
                    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">📄</div>
                    <h3 className="font-black text-indigo-950 line-clamp-2 min-h-[3rem] mb-2">{sheet.topic}</h3>
                    <div className="flex items-center justify-between text-xs font-bold text-indigo-900/40">
                      <span>{sheet.pages.length} STRAN</span>
                      <span>{sheet.createdAt?.toDate().toLocaleDateString('cs-CZ')}</span>
                    </div>
                  </div>
                ))}
                {history.length === 0 && (
                  <div className="col-span-full py-24 text-center space-y-4">
                    <p className="text-indigo-900/40 font-black text-xl">Zatím tu nic není...</p>
                    <button onClick={resetAll} className="text-indigo-600 font-bold hover:underline">Začni své první učení hned teď!</button>
                  </div>
                )}
              </div>
           </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-indigo-900 py-12 px-8 text-white/40 text-sm mt-20 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="space-y-4 text-center md:text-left">
            <div className="flex items-center gap-2 opacity-100 justify-center md:justify-start">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <span className="text-xl font-black text-white tracking-tight">Shate</span>
            </div>
            <p className="max-w-sm font-medium">© 2026 Shate • Váš chytrý studijní asistent s umělou inteligencí pro efektivnější učení.</p>
          </div>
          <div className="flex gap-12 font-bold text-white/60">
             <div className="space-y-3">
               <h4 className="text-white uppercase tracking-widest text-xs">Aplikace</h4>
               <p className="hover:text-white cursor-pointer transition-colors" onClick={resetAll}>Domů</p>
               <p className="hover:text-white cursor-pointer transition-colors" onClick={() => setStep('history')}>Historie</p>
             </div>
             <div className="space-y-3">
               <h4 className="text-white uppercase tracking-widest text-xs">Právní</h4>
               <p className="hover:text-white cursor-pointer transition-colors">Ochrana dat</p>
               <p className="hover:text-white cursor-pointer transition-colors">Podmínky</p>
             </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
