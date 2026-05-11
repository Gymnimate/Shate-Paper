import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { cn } from '../lib/utils';
import { Printer, Zap, Download, ExternalLink, Share2 } from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface StudySheetProps {
  pages: string[];
  isVisible: boolean;
  topic: string;
  id?: string | null;
}

export default function StudySheet({ pages, isVisible, topic, id }: StudySheetProps) {
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById('a4-full-container');
    const opt = {
      margin: 0,
      filename: `Shate-${topic.substring(0, 20)}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
    };
    
    html2pdf().from(element).set(opt).save();
  };

  const handleShare = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = id ? `${baseUrl}?v=${id}` : window.location.href;
    navigator.clipboard.writeText(shareUrl);
    alert('Odkaz byl zkopírován do schránky! Teď ho můžete poslat komukoliv.');
  };

  if (!isVisible || pages.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full mb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end w-full max-w-[210mm] px-4 gap-4 print:hidden">
        <div className="flex flex-col">
          <h3 className="text-indigo-900 font-black text-xl">Náhled tvého výstupu:</h3>
          <span className="text-indigo-400 text-sm font-bold italic">{pages.length} {pages.length === 1 ? 'strana' : pages.length < 5 ? 'strany' : 'stran'} • Shate AI</span>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={handleShare}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-2 border-indigo-100 dark:border-slate-700 rounded-2xl hover:bg-indigo-50 transition-all font-black shadow-lg shadow-indigo-200/50 dark:shadow-none hover:-translate-y-0.5 active:translate-y-0 uppercase tracking-wide text-xs"
          >
            <Share2 className="w-4 h-4" />
            Sdílet
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-2 border-indigo-100 dark:border-slate-700 rounded-2xl hover:bg-indigo-50 transition-all font-black shadow-lg shadow-indigo-200/50 dark:shadow-none hover:-translate-y-0.5 active:translate-y-0 uppercase tracking-wide text-xs"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all font-black shadow-xl shadow-indigo-200 dark:shadow-none hover:-translate-y-0.5 active:translate-y-0 uppercase tracking-wide text-xs"
          >
            <Printer className="w-4 h-4" />
            Tisk
          </button>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-100 dark:border-amber-900/30 p-4 rounded-2xl max-w-[210mm] w-[calc(100%-2rem)] flex items-start gap-3 print:hidden">
        <ExternalLink className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-amber-900 dark:text-amber-200 text-xs font-bold leading-relaxed">
          TIP: Pokud tisk nefunguje nebo pracovní listy přesahují, použijte tlačítko PDF pro dokonalé stažení.
        </p>
      </div>

      <div id="a4-full-container" className="a4-container flex flex-col items-center gap-8 print:gap-0 print:block">
        {pages.map((content, index) => (
          <div 
            key={index}
            className="a4-sheet bg-white shadow-2xl border-x-8 border-t-8 border-indigo-200 rounded-t-3xl p-[15mm] sm:p-[20mm] print:shadow-none print:p-[20mm] print:border-none print:rounded-none relative overflow-hidden"
            style={{ pageBreakAfter: 'always' }}
          >
            {index === 0 && (
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400 rotate-45 translate-x-16 -translate-y-16 flex items-end justify-center pb-4 text-amber-900 font-black print:hidden">
                Shate
              </div>
            )}
            
            <div className="prose prose-indigo max-w-none prose-h1:text-4xl prose-h1:font-bold prose-h1:mb-8 prose-h2:text-2xl prose-h2:font-semibold prose-h2:mt-8 prose-h2:mb-4 prose-p:text-gray-700 prose-p:leading-relaxed prose-li:text-gray-700 marker:text-gray-400 min-h-[235mm] max-h-[235mm] overflow-hidden print:max-h-none print:min-h-0 bg-white">
              <ReactMarkdown 
                remarkPlugins={[remarkMath, remarkGfm]} 
                rehypePlugins={[rehypeKatex]}
              >
                {content}
              </ReactMarkdown>
            </div>
            
            <div className="mt-6 pt-4 border-t-2 border-dashed border-indigo-50 flex justify-between items-center text-[10px] text-indigo-300 italic font-bold uppercase tracking-widest absolute bottom-8 left-[15mm] right-[15mm] sm:left-[20mm] sm:right-[20mm]">
              <div className="flex items-center gap-2">
                <Zap className="w-3 h-3 fill-current" />
                <span>SHATE AI • STRANA {index + 1} / {pages.length}</span>
              </div>
              <span>{new Date().toLocaleDateString('cs-CZ')}</span>
            </div>
          </div>
        ))}
      </div>
      
      <style>{`
        @media screen {
          .a4-container {
            width: 100%;
            max-width: 210mm;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .a4-sheet {
            width: 210mm;
            height: 297mm;
            background: white;
            flex-shrink: 0;
          }
        }
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body {
            background: white !important;
          }
          body * {
            visibility: hidden;
          }
          .a4-container, .a4-container * {
            visibility: visible;
          }
          .a4-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm !important;
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
          }
          .a4-sheet {
            width: 210mm !important;
            height: 297mm !important;
            padding: 20mm !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            page-break-after: always;
            overflow: hidden !important;
            display: block !important;
            background: white !important;
            position: relative !important;
          }
        }
      `}</style>
    </div>
  );
}
