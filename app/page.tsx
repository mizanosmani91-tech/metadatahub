'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Aperture, Upload, SlidersHorizontal, KeyRound, Eye, EyeOff,
  Play, Download, History, Trash2, X, CheckCircle2, Loader2,
  AlertCircle, Search, Coins, ChevronDown, Pencil, RefreshCw, Copy,
  FileImage, FileVideo, FileCode, FileText, HelpCircle, ListChecks, LogOut, LogIn, ExternalLink, Tags
} from 'lucide-react';
import { supabase } from '../utils/supabase';

/* ---------------------------------------------------------------
   Interfaces & Types
--------------------------------------------------------------- */

interface Platform {
  id: string;
  name: string;
  accent: string;
}

interface QueueFile {
  id: number;
  file: File;
  name: string;
  size: number;
  kind: 'image' | 'video' | 'vector' | 'doc';
  previewUrl: string | null;
  status: 'queued' | 'processing' | 'done' | 'error';
  result: {
    title: string;
    description: string;
    keywords: string[];
  } | null;
}

interface HistoryItem {
  id: number;
  time: string;
  count: number;
  platforms: string[];
}

interface ToastItem {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error';
}

interface SliderProps {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  onChange: (val: number) => void;
}

interface ToggleProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
}

interface BuildMetadataParams {
  name: string;
  kind: 'image' | 'video' | 'vector' | 'doc';
  titleLength: number;
  descLength: number;
  keywordCount: number;
}

/* ---------------------------------------------------------------
   Data + helpers
--------------------------------------------------------------- */

const PLATFORMS: Platform[] = [
  { id: 'general', name: 'General', accent: 'stone' },
  { id: 'adobe', name: 'Adobe Stock', accent: 'orange' },
  { id: 'shutterstock', name: 'Shutterstock', accent: 'red' },
  { id: 'getty', name: 'Getty Images', accent: 'amber' },
  { id: 'istock', name: 'iStock', accent: 'sky' },
  { id: 'alamy', name: 'Alamy', accent: 'lime' },
  { id: 'depositphotos', name: 'Depositphotos', accent: 'fuchsia' },
  { id: '123rf', name: '123RF', accent: 'cyan' },
  { id: 'dreamstime', name: 'Dreamstime', accent: 'emerald' },
  { id: 'vecteezy', name: 'Vecteezy', accent: 'rose' },
  { id: 'freepik', name: 'Freepik', accent: 'blue' },
  { id: 'pixabay', name: 'Pixabay', accent: 'teal' },
];

const PLATFORM_ACCENTS: Record<string, string> = {
  stone: 'border-stone-400 text-stone-800 bg-stone-100',
  orange: 'border-orange-400 text-orange-700 bg-orange-50',
  red: 'border-red-400 text-red-750 bg-red-50',
  amber: 'border-amber-400 text-amber-700 bg-amber-50',
  sky: 'border-sky-400 text-sky-750 bg-sky-50',
  lime: 'border-lime-500 text-lime-750 bg-lime-50',
  fuchsia: 'border-fuchsia-400 text-fuchsia-750 bg-fuchsia-50',
  cyan: 'border-cyan-500 text-cyan-750 bg-cyan-50',
  emerald: 'border-emerald-500 text-emerald-750 bg-emerald-50',
  rose: 'border-rose-400 text-rose-750 bg-rose-50',
  blue: 'border-blue-400 text-blue-750 bg-blue-50',
  teal: 'border-teal-500 text-teal-750 bg-teal-50',
};

// Expanded AI Models List (Free and Paid)
const AI_MODELS = [
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Free / Paid)', platform: 'google' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Precise / Paid)', platform: 'google' },
  { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro (Standard)', platform: 'google' },
  { id: 'gpt-4o', name: 'GPT-4o (Premium Quality)', platform: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o mini (Fast & Budget)', platform: 'openai' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet (Accurate)', platform: 'anthropic' },
  { id: 'claude-3-haiku', name: 'Claude 3 Haiku (Ultra-Fast)', platform: 'anthropic' },
];

// Target URLs for dynamic "Get API" redirection
const API_KEY_URLS: Record<string, string> = {
  google: 'https://aistudio.google.com/',
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/',
};

const KEYWORD_POOL: string[] = [
  'business','technology','abstract','background','concept','design','modern','creative',
  'digital','people','lifestyle','travel','food','industry','finance','marketing','education',
  'health','sustainability','minimal','texture','pattern','light','color','professional',
  'success','innovation','future','growth','nature','urban','architecture','fashion','sport',
  'medical','science','communication','team','office','startup','commerce','retail',
  'agriculture','energy','construction','transport','tourism','wellness','beauty','family',
  'celebration','holiday','winter','summer',
];

function extKind(name: string): 'image' | 'video' | 'vector' | 'doc' {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff', 'bmp'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext)) return 'video';
  if (['eps', 'ai', 'svg'].includes(ext)) return 'vector';
  return 'doc';
}

function KindIcon({ kind, className }: { kind: string; className?: string }) {
  if (kind === 'image') return <FileImage className={className} />;
  if (kind === 'video') return <FileVideo className={className} />;
  if (kind === 'vector') return <FileCode className={className} />;
  return <FileText className={className} />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function titleCaseFromName(name: string): string {
  const base = name.replace(/\.[^/.]+$/, '');
  return base
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '').trim() || 'untitled';
}

const DESCRIPTORS: Record<string, string> = {
  image: 'high resolution stock photograph',
  video: 'cinematic stock video clip',
  vector: 'scalable vector illustration',
  doc: 'editable design asset',
};

function buildMetadata({ name, kind, titleLength, descLength, keywordCount }: BuildMetadataParams) {
  const base = titleCaseFromName(name) || 'Untitled Asset';
  let title = `${base} ${DESCRIPTORS[kind]}`.trim();
  if (title.length > titleLength) title = title.slice(0, Math.max(titleLength - 1, 1)).trim() + '\u2026';

  let description = `A ${DESCRIPTORS[kind]} of ${base.toLowerCase()}, suited for commercial and editorial use across digital and print media.`;
  if (description.length > descLength) description = description.slice(0, Math.max(descLength - 1, 1)).trim() + '\u2026';

  const nameWords = base.toLowerCase().split(' ').filter((w) => w.length > 2);
  const pool = Array.from(new Set([...nameWords, ...KEYWORD_POOL]));
  const keywords = pool.slice(0, Math.min(keywordCount, pool.length));

  return { title, description, keywords };
}

function charTone(len: number, limit: number): string {
  const ratio = len / limit;
  if (ratio > 1) return 'text-red-500';
  if (ratio > 0.9) return 'text-amber-600';
  return 'text-emerald-600';
}

function toCSV(rows: any[]): string {
  const header = ['Filename', 'Title', 'Description', 'Keywords', 'Platforms'];
  const esc = (v: any) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [header.map(esc).join(',')];
  rows.forEach((r) => {
    lines.push([r.filename, r.title, r.description, r.keywords.join('; '), r.platforms.join('; ')].map(esc).join(','));
  });
  return lines.join('\n');
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

let idCounter = 1;
const nextId = () => idCounter++;

/* ---------------------------------------------------------------
   Small reusable pieces
--------------------------------------------------------------- */

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    queued: { label: 'Queued', cls: 'bg-stone-100 text-stone-600 border-stone-200' },
    processing: { label: 'Processing', cls: 'bg-amber-50 text-amber-700 border-amber-200/60 shadow-sm' },
    done: { label: 'Done', cls: 'bg-emerald-50 text-emerald-750 border-emerald-200/60 shadow-sm' },
    error: { label: 'Failed', cls: 'bg-red-50 text-red-600 border-red-200/60' },
  };
  const s = map[status] || map.queued;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${s.cls}`}>
      {status === 'processing' && <Loader2 className="h-3 w-3 animate-spin text-amber-600" />}
      {status === 'done' && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
      {status === 'error' && <AlertCircle className="h-3 w-3 text-red-500" />}
      {s.label}
    </span>
  );
}

function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      aria-label={label}
      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
        checked ? 'bg-emerald-600 border-emerald-500' : 'bg-stone-200 border-stone-300'
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function Slider({ label, value, unit, min, max, onChange }: SliderProps) {
  return (
    <div>
      <div className="flex justify-between items-baseline text-xs font-bold text-stone-500 mb-2 tracking-wide">
        <span>{label}</span>
        <span className="font-mono text-emerald-600">{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-stone-200 accent-emerald-500 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      />
    </div>
  );
}

/* ---------------------------------------------------------------
   Main component
--------------------------------------------------------------- */

export default function MetadataStudio() {
  // Generation settings
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['adobe', 'shutterstock']);
  const [aiProvider, setAiProvider] = useState<string>('gemini-1.5-flash');
  const [apiKey, setApiKey] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [titleLength, setTitleLength] = useState<number>(60);
  const [descLength, setDescLength] = useState<number>(150);
  const [keywordCount, setKeywordCount] = useState<number>(30);
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false);
  const [batchSize, setBatchSize] = useState<number>(2);
  const [rpm, setRpm] = useState<number>(15);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [renameOnDownload, setRenameOnDownload] = useState<boolean>(true);
  
  // Feature: Fixed/Static Keywords to append to all files
  const [staticKeywords, setStaticKeywords] = useState<string>('');

  // File queue + results
  const [files, setFiles] = useState<QueueFile[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Supabase User & Credits state
  const [user, setUser] = useState<any>(null);
  const [credits, setCredits] = useState<number>(0);
  const [session, setSession] = useState<any>(null);

  // Auth UI state
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // Misc UI state
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pushToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = nextId();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };

  // Auth & Session listener + Load locally saved settings from LocalStorage
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchUserProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setCredits(0);
        setHistory([]);
      }
    });

    // Load local settings
    const cachedApiKey = localStorage.getItem('apiKey') || '';
    const cachedTitleLength = localStorage.getItem('titleLength');
    const cachedDescLength = localStorage.getItem('descLength');
    const cachedKeywordCount = localStorage.getItem('keywordCount');
    const cachedStaticKeywords = localStorage.getItem('staticKeywords') || '';
    const cachedPlatforms = localStorage.getItem('selectedPlatforms');

    if (cachedApiKey) setApiKey(cachedApiKey);
    if (cachedTitleLength) setTitleLength(Number(cachedTitleLength));
    if (cachedDescLength) setDescLength(Number(cachedDescLength));
    if (cachedKeywordCount) setKeywordCount(Number(cachedKeywordCount));
    if (cachedStaticKeywords) setStaticKeywords(cachedStaticKeywords);
    if (cachedPlatforms) {
      try { setSelectedPlatforms(JSON.parse(cachedPlatforms)); } catch (e) {}
    }

    return () => {
      subscription.unsubscribe();
      files.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSettingsLocally = () => {
    localStorage.setItem('apiKey', apiKey);
    localStorage.setItem('titleLength', String(titleLength));
    localStorage.setItem('descLength', String(descLength));
    localStorage.setItem('keywordCount', String(keywordCount));
    localStorage.setItem('staticKeywords', staticKeywords);
    localStorage.setItem('selectedPlatforms', JSON.stringify(selectedPlatforms));
    pushToast('Your settings have been saved locally!', 'success');
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', userId)
        .single();
      if (error) throw error;
      setCredits(data.credits);
      fetchHistory(userId);
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const fetchHistory = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('generations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setHistory((data || []).map((h: any) => ({
        id: h.id,
        time: new Date(h.created_at).toLocaleString(),
        count: h.file_count,
        platforms: h.platforms
      })));
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  /* ---------------- Auth handlers ---------------- */

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        pushToast('Registration successful! Check email or try logging in.', 'success');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        pushToast('Successfully logged in!', 'success');
        setShowAuthModal(false);
      }
    } catch (err: any) {
      pushToast(err.message, 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    pushToast('Logged out.', 'info');
  };

  /* ---------------- file queue handlers ---------------- */

  const addFiles = (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList).map((file) => {
      const kind = extKind(file.name);
      return {
        id: nextId(),
        file,
        name: file.name,
        size: file.size,
        kind,
        previewUrl: kind === 'image' ? URL.createObjectURL(file) : null,
        status: 'queued' as const,
        result: null,
      };
    });
    setFiles((f) => [...f, ...incoming]);
    pushToast(`${incoming.length} file${incoming.length > 1 ? 's' : ''} added to the queue`, 'success');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length) addFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const removeFile = (id: number) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  const clearAll = () => {
    files.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
    setFiles([]);
    pushToast('Queue cleared', 'info');
  };

  /* ---------------- generation ---------------- */

  const platformNames = () => PLATFORMS.filter((p) => selectedPlatforms.includes(p.id)).map((p) => p.name);

  const generateOne = async (id: number) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: 'processing' } : f)));
    const target = files.find((f) => f.id === id);
    if (!target) return;

    if (target.kind !== 'image') {
      setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: 'error' } : f)));
      pushToast(`${target.name}: only image files can be analyzed right now`, 'error');
      return;
    }

    try {
      const base64 = await fileToBase64(target.file);
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      
      // Inject user bearer token securely if they don't use their own API key
      if (!apiKey && session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/generate-metadata', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          provider: aiProvider,
          apiKey,
          imageBase64: base64,
          mediaType: target.file.type || 'image/jpeg',
          titleLength, descLength, keywordCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      
      // Feature implementation: Merge AI output keywords with our static default keywords, avoiding duplicates
      const finalGeneratedKeywords = data.keywords || [];
      const userStaticKeywords = staticKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
      const mergedKeywords = Array.from(new Set([...finalGeneratedKeywords, ...userStaticKeywords]));
      data.keywords = mergedKeywords;

      setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: 'done', result: data } : f)));
      
      // Refresh user credits if system key was used
      if (user && !apiKey) fetchUserProfile(user.id);

    } catch (err: any) {
      setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: 'error' } : f)));
      pushToast(err.message || 'Generation failed', 'error');
    }
  };

  const handleGenerate = () => {
    if (selectedPlatforms.length === 0) {
      pushToast('Select at least one platform first', 'error');
      return;
    }
    const queued = files.filter((f) => f.status === 'queued' || f.status === 'error');
    if (queued.length === 0) {
      pushToast('Nothing left to generate', 'info');
      return;
    }

    // Require Login if using system key
    if (!apiKey && !user) {
      pushToast('Please log in or enter your own API key to generate metadata.', 'error');
      setShowAuthModal(true);
      return;
    }

    if (!apiKey && credits <= 0) {
      pushToast('No credits left, add your own API key to keep generating.', 'error');
      return;
    }

    let creditsLeft = credits;
    queued.forEach((f, idx) => {
      setTimeout(() => {
        if (apiKey || creditsLeft > 0) {
          if (!apiKey) creditsLeft -= 1;
          generateOne(f.id);
        } else {
          setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: 'error' } : x)));
        }
      }, Math.floor(idx / batchSize) * 450);
    });
    pushToast(`Generating metadata for ${queued.length} file${queued.length > 1 ? 's' : ''}`, 'info');
  };

  const regenerateOne = (id: number) => {
    if (!apiKey && credits <= 0) {
      pushToast('No credits left', 'error');
      return;
    }
    generateOne(id);
  };

  /* ---------------- editing results ---------------- */

  const updateResult = (id: number, patch: any) => {
    setFiles((prev) => prev.map((f) => {
      if (f.id === id && f.result) {
        return { ...f, result: { ...f.result, ...patch } };
      }
      return f;
    }));
  };

  const copyResult = (f: QueueFile) => {
    if (!f.result) return;
    const text = `${f.result.title}\n\n${f.result.description}\n\n${f.result.keywords.join(', ')}`;
    navigator.clipboard?.writeText(text);
    pushToast('Copied to clipboard', 'success');
  };

  /* ---------------- export ---------------- */

  const handleExportCSV = async () => {
    const done = files.filter((f) => f.status === 'done');
    if (done.length === 0) {
      pushToast('Generate metadata before exporting', 'error');
      return;
    }

    // Save Generation History in Database securely
    if (user) {
      try {
        const { error } = await supabase.from('generations').insert({
          user_id: user.id,
          file_count: done.length,
          platforms: platformNames(),
        });
        if (error) throw error;
        fetchHistory(user.id);
      } catch (err: any) {
        console.error('Error saving export history:', err.message);
      }
    }

    const rows = done.map((f) => ({
      filename: f.name,
      title: f.result?.title || '',
      description: f.result?.description || '',
      keywords: f.result?.keywords || [],
      platforms: platformNames(),
    }));
    const blob = new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'metadata_export.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    
    if (!user) {
      setHistory((h) => [{ id: nextId(), time: new Date().toLocaleString(), count: done.length, platforms: platformNames() }, ...h]);
    }
    pushToast('CSV exported', 'success');
  };

  const handleDownloadFiles = () => {
    const done = files.filter((f) => f.status === 'done');
    if (done.length === 0) {
      pushToast('Nothing generated yet', 'error');
      return;
    }
    done.forEach((f, idx) => {
      setTimeout(() => {
        const ext = f.name.split('.').pop();
        const finalTitle = f.result?.title ? sanitizeFilename(f.result.title) : 'untitled';
        const finalName = renameOnDownload ? `${finalTitle}.${ext}` : f.name;
        const url = URL.createObjectURL(f.file);
        const a = document.createElement('a');
        a.href = url;
        a.download = finalName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }, idx * 200);
    });
    pushToast(`Downloading ${done.length} file${done.length > 1 ? 's' : ''}`, 'info');
  };

  /* ---------------- derived ---------------- */

  const doneCount = files.filter((f) => f.status === 'done').length;
  const visibleFiles = files.filter((f) => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const step = files.length === 0 ? 1 : files.some((f) => f.status === 'processing') ? 3 : doneCount === files.length ? 4 : 2;

  const togglePlatform = (id: string) =>
    setSelectedPlatforms((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  // Dynamically find API Portal URL based on selected model's platform
  const getSelectedModelPlatform = () => {
    const selected = AI_MODELS.find(m => m.id === aiProvider);
    return selected ? selected.platform : 'google';
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-850 font-sans antialiased">
      <style>{`
        .sprocket {
          background-image: radial-gradient(circle, rgba(16, 185, 129, 0.12) 2px, transparent 2.6px);
          background-repeat: repeat-x;
          background-size: 18px 100%;
          background-position: center;
        }
        .qscroll::-webkit-scrollbar { width: 6px; }
        .qscroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      `}</style>

      {/* Header */}
      <header className="border-b border-stone-200 bg-white/95 backdrop-blur px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 p-2 rounded-lg shadow-sm">
            <Aperture className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-xl font-extrabold text-stone-900 tracking-tight">NovaMeta</span>
            <span className="text-[11px] block text-stone-400 font-semibold tracking-wide uppercase">Batch metadata for stock contributors</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs font-bold text-stone-700 bg-stone-100 border border-stone-200 px-3 py-2 rounded-lg">
                <Coins className="h-4 w-4 text-emerald-500" />
                <span className="font-mono">{credits}</span><span className="text-stone-400">/ credits</span>
              </div>
              <span className="text-xs text-stone-500 hidden md:inline truncate max-w-[120px]">{user.email}</span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-xs font-bold text-red-600 hover:text-red-500 bg-stone-100 hover:bg-stone-200 px-3 py-2 rounded-lg border border-stone-200 transition-colors"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-2 text-xs font-extrabold text-white bg-emerald-500 hover:bg-emerald-600 px-4 py-2 rounded-lg transition-colors shadow"
            >
              <LogIn className="h-4 w-4" /> Sign In / Sign Up
            </button>
          )}
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-2 text-xs font-bold text-stone-650 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-3.5 py-2 rounded-lg border border-stone-200 transition-colors"
          >
            <History className="h-4 w-4" /> History
          </button>
        </div>
      </header>

      {/* Stepper */}
      <div className="border-b border-stone-200 bg-stone-100/50 px-6 py-2.5">
        <div className="max-w-[1500px] mx-auto flex items-center gap-2 overflow-x-auto">
          {['Upload', 'Configure', 'Generate', 'Export'].map((label, i) => {
            const n = i + 1;
            const active = n === step;
            const complete = n < step;
            return (
              <div key={label} className="flex items-center gap-2 shrink-0">
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold ${
                  active ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50' :
                  complete ? 'border-stone-300 text-stone-400 bg-stone-50' : 'border-stone-200 text-stone-400'
                }`}>
                  <span className="font-mono">{String(n).padStart(2, '0')}</span>
                  <span>{label}</span>
                </div>
                {n < 4 && <div className="h-px w-6 bg-stone-200" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main */}
      <main className="max-w-[1500px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Controls */}
        <aside className="lg:col-span-4 space-y-5">
          <div className="bg-white border border-emerald-100 shadow-[0_12px_30px_rgba(16,185,129,0.06)] rounded-2xl p-5 space-y-5">
            <div className="flex items-center gap-2 border-b border-stone-200 pb-3">
              <SlidersHorizontal className="h-4.5 w-4.5 text-emerald-500" />
              <h2 className="text-sm font-bold text-stone-800 tracking-wide uppercase">Generation controls</h2>
            </div>

            {/* Platforms */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-stone-500 tracking-wide">Target platforms</label>
                <span className="text-[11px] font-mono text-stone-400">{selectedPlatforms.length} selected</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map((p) => {
                  const active = selectedPlatforms.includes(p.id);
                  const activeClass = PLATFORM_ACCENTS[p.accent] || 'border-stone-400 text-stone-850 bg-stone-100';
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePlatform(p.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-550 ${
                        active ? activeClass : 'border-stone-200 text-stone-500 bg-stone-50/50 hover:border-stone-300 hover:text-stone-700'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-current' : 'bg-stone-300'}`} />
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* AI engine + dynamic "Get API" redirection */}
            <div className="space-y-3 border-t border-stone-200 pt-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-stone-500 tracking-wide block">AI engine</label>
                  <a
                    href={API_KEY_URLS[getSelectedModelPlatform()]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-500 transition-colors hover:underline"
                  >
                    Get API Key <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <select
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2.5 text-sm text-stone-850 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  {AI_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-xs font-bold text-stone-500 tracking-wide block mb-1.5">API key</label>
                <div className="relative">
                  <KeyRound className="h-4 w-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Paste your key"
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-9 pr-10 py-2.5 text-sm text-stone-850 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-655">
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-stone-400 mt-1.5">Not stored on our servers. Leave blank to use your accounts balance.</p>
              </div>
            </div>

            {/* Static Keywords / Tags Pool Manager */}
            <div className="space-y-2 border-t border-stone-200 pt-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-stone-500 tracking-wide">
                <Tags className="h-4 w-4 text-emerald-500" />
                <span>Static Keywords (appends to all)</span>
              </div>
              <textarea
                value={staticKeywords}
                onChange={(e) => setStaticKeywords(e.target.value)}
                placeholder="tag1, tag2, tag3 (Appends permanently to all files in the batch)"
                rows={2}
                className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>

            {/* Sliders */}
            <div className="space-y-4 border-t border-stone-200 pt-4">
              <Slider label="Title length" value={titleLength} unit=" chars" min={10} max={150} onChange={setTitleLength} />
              <Slider label="Description length" value={descLength} unit=" chars" min={50} max={300} onChange={setDescLength} />
              <Slider label="Keywords" value={keywordCount} unit=" tags" min={10} max={50} onChange={setKeywordCount} />
            </div>

            {/* Advanced */}
            <div className="border-t border-stone-200 pt-4">
              <button onClick={() => setAdvancedOpen(!advancedOpen)} className="w-full flex items-center justify-between text-xs font-bold text-stone-500 hover:text-stone-800">
                <span className="tracking-wide uppercase">Advanced settings</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              </button>
              {advancedOpen && (
                <div className="space-y-4 mt-4">
                  <Slider label="Batch size (concurrent)" value={batchSize} unit="x" min={1} max={10} onChange={setBatchSize} />
                  <Slider label="Requests per minute" value={rpm} unit="/min" min={5} max={60} onChange={setRpm} />
                  <div>
                    <label className="text-xs font-bold text-stone-500 tracking-wide block mb-1.5">Custom prompt (optional)</label>
                    <textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      rows={3}
                      placeholder="Override the default instructions sent to the AI engine..."
                      className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-xs text-stone-750 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    />
                  </div>
                  <div className="flex items-center justify-between font-medium">
                    <span className="text-xs text-stone-600">Rename files to title on download</span>
                    <Toggle checked={renameOnDownload} onChange={setRenameOnDownload} label="Rename files on download" />
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={saveSettingsLocally}
              className="w-full bg-white border border-emerald-500 text-emerald-600 hover:bg-emerald-50 font-bold text-sm py-2.5 rounded-lg transition-colors shadow-sm"
            >
              Save settings
            </button>
          </div>
        </aside>

        {/* Workspace */}
        <section className="lg:col-span-8 space-y-5">

          {/* Dropzone with Soft Green Dashed Border */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-colors shadow-[0_12px_30px_rgba(16,185,129,0.03)] ${
              isDragging ? 'border-emerald-500 bg-emerald-50/40' : 'border-emerald-200 bg-white hover:border-emerald-400'
            }`}
          >
            <div className="sprocket h-2.5 w-full absolute top-0 left-0 rounded-t-2xl opacity-40" />
            <input ref={fileInputRef} type="file" multiple onChange={handleInputChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
            <div className="space-y-3 max-w-md mx-auto py-5">
              <div className="mx-auto w-14 h-14 bg-stone-50 border border-emerald-100 rounded-xl flex items-center justify-center shadow-sm">
                <Upload className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-800">Drop files, or click to browse</h3>
                <p className="text-xs text-stone-500 mt-1">JPG, PNG, GIF, MP4, MOV, EPS, AI, PDF \u2014 up to 100 files</p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-extrabold transition-colors relative z-0 shadow-sm"
              >
                Browse files
              </button>
            </div>
          </div>

          {/* Queue */}
          {files.length > 0 && (
            <div className="bg-white border border-emerald-100 rounded-2xl p-5 space-y-3 shadow-[0_12px_30px_rgba(16,185,129,0.06)]">
              <div className="flex justify-between items-center border-b border-stone-200 pb-3">
                <span className="text-sm font-bold text-stone-800">Queue \u00b7 <span className="font-mono text-stone-500">{files.length}</span> files \u00b7 <span className="font-mono text-emerald-600 font-extrabold">{doneCount}</span> done</span>
                <button onClick={clearAll} className="text-xs text-stone-400 hover:text-red-500 font-bold flex items-center gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" /> Clear all
                </button>
              </div>
              <div className="max-h-56 overflow-y-auto qscroll space-y-1.5 pr-1">
                {files.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 p-2.5 bg-stone-50 border border-stone-200 rounded-lg text-xs">
                    {f.previewUrl ? (
                      <img src={f.previewUrl} alt="" className="h-8 w-8 rounded object-cover border border-stone-200 flex-shrink-0 bg-white" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-white border border-stone-200 flex items-center justify-center flex-shrink-0">
                        <KindIcon kind={f.kind} className="h-4 w-4 text-stone-400" />
                      </div>
                    )}
                    <span className="text-stone-700 truncate flex-1 font-medium">{f.name}</span>
                    <span className="text-stone-400 font-mono flex-shrink-0">{formatBytes(f.size)}</span>
                    <StatusPill status={f.status} />
                    <button onClick={() => removeFile(f.id)} className="text-stone-400 hover:text-red-500 flex-shrink-0">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2.5 pt-1">
                <button onClick={handleGenerate} className="flex-1 flex items-center justify-center gap-2 bg-emerald-550 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-extrabold text-sm transition-colors shadow">
                  <Play className="h-4 w-4 fill-white" /> Generate metadata
                </button>
                <button onClick={handleExportCSV} className="flex items-center gap-2 border border-emerald-600 text-emerald-600 hover:bg-emerald-50/50 px-4 py-2.5 rounded-lg font-bold text-sm transition-colors bg-white shadow-sm">
                  <Download className="h-4 w-4" /> Export CSV
                </button>
                <button onClick={handleDownloadFiles} className="flex items-center gap-2 border border-stone-250 text-stone-600 hover:bg-stone-50 px-4 py-2.5 rounded-lg font-bold text-sm transition-colors bg-white shadow-sm">
                  <Download className="h-4 w-4" /> Download files
                </button>
              </div>
            </div>
          )}

          {/* Results */}
          <div className="bg-white border border-emerald-100 rounded-2xl p-5 shadow-[0_12px_30px_rgba(16,185,129,0.06)]">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3 mb-1 gap-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4.5 w-4.5 text-emerald-500" />
                <h2 className="text-sm font-bold text-stone-800 tracking-wide uppercase">Generated outputs</h2>
              </div>
              {files.length > 0 && (
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filter by filename"
                    className="bg-stone-50 border border-stone-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-44"
                  />
                </div>
              )}
            </div>

            {files.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-center mx-auto">
                  <FileText className="h-5 w-5 text-stone-400" />
                </div>
                <p className="text-sm font-bold text-stone-700">No files in the queue yet</p>
                <p className="text-xs text-stone-400 max-w-sm mx-auto">Add files above, then generate metadata to see titles, descriptions, and keywords here.</p>
              </div>
            ) : (
              <div className="space-y-3 pt-3">
                {visibleFiles.map((f) => (
                  <div key={f.id} className="border border-stone-200 rounded-xl p-4 bg-stone-50/50">
                    <div className="flex items-center justify-between mb-2.5 border-b border-stone-100 pb-2">
                      <span className="text-xs font-bold text-stone-700 truncate">{f.name}</span>
                      <div className="flex items-center gap-2">
                        <StatusPill status={f.status} />
                        {f.status === 'done' && (
                          <>
                            <button onClick={() => regenerateOne(f.id)} title="Regenerate" className="text-stone-400 hover:text-emerald-550"><RefreshCw className="h-3.5 w-3.5" /></button>
                            <button onClick={() => setEditingId(editingId === f.id ? null : f.id)} title="Edit" className="text-stone-400 hover:text-emerald-550"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => copyResult(f)} title="Copy" className="text-stone-400 hover:text-emerald-550"><Copy className="h-3.5 w-3.5" /></button>
                          </>
                        )}
                      </div>
                    </div>

                    {f.status !== 'done' ? (
                      <p className="text-xs text-stone-450 italic">
                        {f.status === 'processing' ? 'Generating\u2026' : f.status === 'error' ? 'Generation failed \u2014 try again.' : 'Waiting to generate.'}
                      </p>
                    ) : editingId === f.id ? (
                      <div className="space-y-2">
                        <textarea value={f.result?.title || ''} onChange={(e) => updateResult(f.id, { title: e.target.value })} rows={1} className="w-full bg-white border border-stone-250 rounded-lg px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                        <textarea value={f.result?.description || ''} onChange={(e) => updateResult(f.id, { description: e.target.value })} rows={2} className="w-full bg-white border border-stone-250 rounded-lg px-3 py-2 text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                        <input
                          value={f.result?.keywords?.join(', ') || ''}
                          onChange={(e) => updateResult(f.id, { keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean) })}
                          className="w-full bg-white border border-stone-250 rounded-lg px-3 py-2 text-xs font-mono text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <button onClick={() => setEditingId(null)} className="text-xs font-bold text-emerald-600 hover:text-emerald-500">Done editing</button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold text-stone-900">{f.result?.title}</p>
                          <span className={`text-[11px] font-mono flex-shrink-0 ${charTone(f.result?.title.length || 0, titleLength)}`}>{f.result?.title.length || 0}/{titleLength}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs text-stone-600">{f.result?.description}</p>
                          <span className={`text-[11px] font-mono flex-shrink-0 ${charTone(f.result?.description.length || 0, descLength)}`}>{f.result?.description.length || 0}/{descLength}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {f.result?.keywords?.map((k) => (
                            <span key={k} className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-stone-100 border border-stone-200 text-stone-500">{k}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white border border-stone-200 rounded-2xl p-6 shadow-2xl space-y-4">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute right-4 top-4 text-stone-400 hover:text-stone-650"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="text-center">
              <h3 className="text-lg font-extrabold text-stone-100">
                {isSignUp ? 'Create an Account' : 'Welcome Back'}
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                {isSignUp ? 'Sign up to get 50 free credits instantly.' : 'Log in to manage your balance & exports.'}
              </p>
            </div>
            <form onSubmit={handleAuth} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-stone-500 block mb-1">Email address</label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3.5 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-500 block mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3.5 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-700 text-white font-bold text-sm py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 shadow"
              >
                {authLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSignUp ? 'Register Account' : 'Sign In'}
              </button>
            </form>
            <div className="text-center pt-2 border-t border-stone-200">
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-bold underline underline-offset-2"
              >
                {isSignUp ? 'Already have an account? Sign In' : 'New here? Create an Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History drawer */}
      {historyOpen && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-stone-900/40" onClick={() => setHistoryOpen(false)} />
          <div className="relative w-80 bg-white border-l border-stone-200 h-full p-5 overflow-y-auto qscroll shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3 mb-4">
              <h3 className="text-sm font-bold text-stone-850 uppercase tracking-wide">Export history</h3>
              <button onClick={() => setHistoryOpen(false)} className="text-stone-400 hover:text-stone-600"><X className="h-4 w-4" /></button>
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-stone-400">Exports you make this session will show up here.</p>
            ) : (
              <div className="space-y-2.5">
                {history.map((h) => (
                  <div key={h.id} className="border border-stone-200 rounded-lg p-3 text-xs bg-stone-50/50">
                    <p className="font-mono text-stone-400">{h.time}</p>
                    <p className="text-stone-800 font-semibold mt-1">{h.count} files exported</p>
                    <p className="text-stone-500 mt-0.5">{h.platforms.join(', ')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 w-72">
        {toasts.map((t) => (
          <div key={t.id} className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg border text-xs font-semibold shadow-lg ${
            t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
            t.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
            'bg-white border-stone-200 text-stone-850'
          }`}>
            {t.type === 'success' && <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />}
            {t.type === 'error' && <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}