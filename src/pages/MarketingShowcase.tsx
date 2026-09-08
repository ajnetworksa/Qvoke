import React, { useState, useEffect } from 'react';
import { useERPStore } from '../store';
import { UI_THEMES } from '../theme';
import {
  Sparkles, Play, Pause, RotateCcw, Monitor, Tablet, Smartphone,
  CheckCircle2, ArrowRight, ShieldCheck, Zap, Download, Layers,
  Receipt, DollarSign, Users, Award, Star, Compass, Terminal, FileText, ChevronRight,
  Video, Eye, Image, Copy, Check
} from 'lucide-react';

export const MarketingShowcase: React.FC = () => {
  const { uiTheme, setUITheme, setRoute } = useERPStore();
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  
  // Interactive marketing video player state
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [copiedSvg, setCopiedSvg] = useState(false);

  const videoSteps = [
    {
      title: 'Scene 1: AI Document Builder & RFQ Engine',
      titleAr: 'المشهد 1: إنشاء عروض الأسعار الذكية بالذكاء الاصطناعي',
      tag: 'AI GENERATOR',
      image: '/qvoke_marketing_hero.jpg',
      badge: 'PROPOSALS & BOQ',
      description: 'Upload PDF RFQs or Excel lists. Qvoke automatically categorizes security line items, computes markup margins, and generates branded bilingual proposals in seconds.',
      script: '“Say goodbye to manual quote calculations. With Qvoke AI document builder, complex engineering proposals with automatic margins are ready in under 30 seconds.”',
      scriptAr: 'وداعاً لحسابات التسعير اليدوية. مع كفوك، عروض الأسعار الهندسية جاهزة خلال 30 ثانية فقط مع هوامش الربح التلقائية.'
    },
    {
      title: 'Scene 2: Saudi ZATCA Phase 1 & 2 Compliant Invoicing',
      titleAr: 'المشهد 2: الفوترة الإلكترونية المعتمدة من هيئة الزكاة',
      tag: 'COMPLIANCE 100%',
      image: '/qvoke_marketing_hero.jpg',
      badge: 'ZATCA TLV QR',
      description: 'Generate fully certified Base64 TLV QR codes, bilingual Arabic/English layouts, input VAT expense deductions, and automated tax return ledgers.',
      script: '“Fully certified for Saudi ZATCA e-invoicing Phase 1 and 2. Instantly generate cryptographic TLV QR codes with zero friction.”',
      scriptAr: 'متوافق كلياً مع متطلبات هيئة الزكاة والضريبة والجمارك للمرحلة الأولى والثانية مع تشفير رمز الاستجابة السريعة الفوري.'
    },
    {
      title: 'Scene 3: Real-Time Mobile & Retail POS Checkout',
      titleAr: 'المشهد 3: نظام نقاط البيع السريع وتتبع المخزون الفوري',
      tag: 'RETAIL & MOBILE POS',
      image: '/qvoke_mobile_pos.jpg',
      badge: 'INSTANT CHECKOUT',
      description: 'Lightning-fast barcode checkout on phones and handheld terminals with split payments, thermal receipt printing, and automated stock inventory deductions.',
      script: '“Turn any smartphone or handheld terminal into a high-speed POS register with automated warehouse stock deduction on every sale.”',
      scriptAr: 'حوّل أي هاتف ذكي أو جهاز نقاط بيع محمول إلى كاشير فائق السرعة مع خصم المخزون آلياً فور إتمام العملية.'
    },
    {
      title: 'Scene 4: Next-Gen Glassmorphism, Neumorphism & Material 3',
      titleAr: 'المشهد 4: محرك السمات المتطور وتصميم الزجاج الشفاف وماتيريال ديزاين',
      tag: 'VISUAL DESIGN',
      image: '/qvoke_3d_logo.jpg',
      badge: 'FROSTED GLASS, NEO & M3',
      description: 'Switch between Modern Enterprise, Frosted Glassmorphism, 3D Neumorphism, and Material Design 3 with one click.',
      script: '“A visual revolution in enterprise ERP. Ultra-modern frosted glass, tactile neumorphism, and Google Material Design 3 systems.”',
      scriptAr: 'ثورة بصرية في أنظمة إدارة الشركات. تصميم زجاجي شفاف ونيومورفيزم مجسم وماتيريال ديزاين 3 قابل للتبديل فوراً.'
    },
    {
      title: 'Scene 5: Client Portal & Electronic Signatures',
      titleAr: 'المشهد 5: بوابات العملاء التفاعلية والتوقيع الإلكتروني',
      tag: 'DIGITAL SIGNATURE',
      image: '/qvoke_marketing_hero.jpg',
      badge: 'CLIENT APPROVALS',
      description: 'Send tokenized client portal links via WhatsApp and Email for instant customer approval, digital e-signatures, and real-time status updates.',
      script: '“Close deals 3x faster with direct client portal links. Customers review and legally sign quotations on their phones without requiring logins.”',
      scriptAr: 'أغلق صفقاتك أسرع بثلاث مرات. يراجع العميل العرض ويوقّعه إلكترونياً من هاتفه مباشرة بدون الحاجة لتسجيل دخول.'
    }
  ];

  useEffect(() => {
    let timer: any;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentStep((prev) => (prev + 1) % videoSteps.length);
      }, 6000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, videoSteps.length]);

  const handleCopySvg = () => {
    fetch('/qvoke-logo.svg')
      .then(res => res.text())
      .then(text => {
        navigator.clipboard.writeText(text);
        setCopiedSvg(true);
        setTimeout(() => setCopiedSvg(false), 2500);
      });
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] py-8 px-4 sm:px-6 lg:px-8 animate-fade-in text-left">
      {/* Hero Header */}
      <div className="max-w-6xl mx-auto text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-primary)] text-xs font-black uppercase tracking-wider mb-4">
          <Sparkles className="w-4 h-4 animate-spin" /> Next-Generation Enterprise Suite
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4">
          Qvoke ERP &amp; Billing System
        </h1>
        <p className="text-base sm:text-lg text-[var(--color-text-muted)] max-w-2xl mx-auto leading-relaxed">
          The all-in-one business platform for smart quotations, ZATCA e-invoicing, retail POS, expense control, and client e-signatures.
        </p>

        {/* CTA Bar */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setRoute('dashboard')}
            className="px-6 py-3 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold transition-all shadow-lg shadow-[var(--color-primary)]/25 flex items-center gap-2 cursor-pointer"
          >
            <span>Launch Qvoke App / فتح المنظومة</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <a
            href="/qvoke_3d_logo.jpg"
            download="qvoke-3d-master-logo.jpg"
            className="px-5 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-offset)] text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-[var(--color-primary)]" />
            <span>Download 4K Brand Logo (PNG/JPG)</span>
          </a>

          <a
            href="/qvoke-logo.svg"
            download="qvoke-brand-logo.svg"
            className="px-5 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-offset)] text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-teal-500" />
            <span>Download Vector Logo (SVG)</span>
          </a>
        </div>
      </div>

      {/* Brand Identity & Master Logo Showcase */}
      <div className="max-w-6xl mx-auto mb-16">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-2">
            Official Brand Identity &amp; Logo Suite
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            High-resolution geometric logo emblems and vector assets ready for web, mobile, and print marketing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: 3D Master Emblem */}
          <div className="premium-card p-6 flex flex-col items-center justify-between text-center group hover:border-[var(--color-primary)] transition-all">
            <div className="w-full aspect-square rounded-2xl overflow-hidden mb-4 border border-[var(--color-border)] bg-slate-950 flex items-center justify-center p-2 shadow-inner">
              <img
                src="/qvoke_3d_logo.jpg"
                alt="Qvoke 3D Master Logo"
                className="w-full h-full object-contain rounded-xl group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-primary)] block mb-1">
                MASTER LOGO EMBLEM
              </span>
              <h3 className="text-base font-extrabold text-[var(--color-text)] mb-1">
                Qvoke 3D Geometric "Q"
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mb-4">
                Cyan-to-violet flowing ribbons forming the signature geometric "Q".
              </p>
            </div>
            <a
              href="/qvoke_3d_logo.jpg"
              download="qvoke-3d-master-logo.jpg"
              className="w-full py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Download className="w-4 h-4" /> Download 4K Master (JPG)
            </a>
          </div>

          {/* Card 2: Vector SVG Logo */}
          <div className="premium-card p-6 flex flex-col items-center justify-between text-center group hover:border-[var(--color-primary)] transition-all">
            <div className="w-full aspect-square rounded-2xl overflow-hidden mb-4 border border-[var(--color-border)] bg-slate-900 flex items-center justify-center p-8 shadow-inner">
              <img
                src="/qvoke-logo.svg"
                alt="Qvoke Vector Logo"
                className="w-48 h-auto object-contain group-hover:scale-110 transition-transform duration-500"
              />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-teal-500 block mb-1">
                VECTOR BRANDMARK
              </span>
              <h3 className="text-base font-extrabold text-[var(--color-text)] mb-1">
                Qvoke Typography &amp; Icon
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mb-4">
                Lossless SVG vector format suitable for billboard printing and dark/light UI.
              </p>
            </div>
            <div className="w-full flex items-center gap-2">
              <a
                href="/qvoke-logo.svg"
                download="qvoke-brand-logo.svg"
                className="flex-1 py-2.5 rounded-xl bg-[var(--color-surface-offset)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[var(--color-surface-2)]"
              >
                <Download className="w-4 h-4" /> SVG File
              </a>
              <button
                onClick={handleCopySvg}
                className="px-3 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                title="Copy raw SVG code"
              >
                {copiedSvg ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Card 3: Mobile App Icon */}
          <div className="premium-card p-6 flex flex-col items-center justify-between text-center group hover:border-[var(--color-primary)] transition-all">
            <div className="w-full aspect-square rounded-2xl overflow-hidden mb-4 border border-[var(--color-border)] bg-slate-950 flex items-center justify-center p-8 shadow-inner">
              <img
                src="/qvoke-icon.svg"
                alt="Qvoke App Icon"
                className="w-32 h-32 object-contain group-hover:scale-110 transition-transform duration-500"
              />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 block mb-1">
                APP LAUNCHER ICON
              </span>
              <h3 className="text-base font-extrabold text-[var(--color-text)] mb-1">
                Qvoke Mobile &amp; PWA Icon
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mb-4">
                Optimized 512x512 app launcher icon for iOS, Android, and Web PWA.
              </p>
            </div>
            <a
              href="/qvoke-icon.svg"
              download="qvoke-app-icon.svg"
              className="w-full py-2.5 rounded-xl bg-[var(--color-surface-offset)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[var(--color-surface-2)]"
            >
              <Download className="w-4 h-4" /> Download App Icon (SVG)
            </a>
          </div>
        </div>
      </div>

      {/* Cinematic Marketing Video Walkthrough & Storyboard Player */}
      <div className="max-w-6xl mx-auto mb-16">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-600 dark:text-teal-400 text-xs font-black uppercase tracking-wider mb-2">
            <Video className="w-4 h-4" /> Marketing Video Tour &amp; Commercial Storyboard
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-2">
            Cinematic Product Video &amp; Feature Walkthrough
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Full commercial script, scene transitions, and visual previews ready for product launch videos and client presentations.
          </p>
        </div>

        <div className="premium-card p-6 sm:p-8 overflow-hidden relative border-2 border-[var(--color-primary)]/40 shadow-2xl">
          {/* Header of Video Player */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-divider)]/40 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)] text-white flex items-center justify-center font-black">
                <Play className="w-5 h-5 fill-current" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-[var(--color-primary)] tracking-wider block">
                  Commercial Product Video • Scene {currentStep + 1} of {videoSteps.length}
                </span>
                <h3 className="text-base font-extrabold text-[var(--color-text)]">
                  {videoSteps[currentStep].title}
                </h3>
                <span className="text-xs text-[var(--color-text-muted)] block" dir="rtl">
                  {videoSteps[currentStep].titleAr}
                </span>
              </div>
            </div>

            {/* Play/Pause & Step Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="px-3 py-2 rounded-lg bg-[var(--color-surface-offset)] border border-[var(--color-border)] text-xs font-bold hover:bg-[var(--color-surface-2)] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isPlaying ? 'Pause Auto-Play' : 'Play Tour'}</span>
              </button>
              <button
                onClick={() => setCurrentStep(0)}
                className="p-2 rounded-lg bg-[var(--color-surface-offset)] border border-[var(--color-border)] text-xs font-bold hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
                title="Restart Tour"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main Video Scene Visual Display */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
            {/* Left: Photorealistic Screen Mockup */}
            <div className="lg:col-span-7 rounded-2xl overflow-hidden border border-[var(--color-border)] bg-slate-950 relative group">
              <img
                src={videoSteps[currentStep].image}
                alt={videoSteps[currentStep].title}
                className="w-full h-80 object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-5">
                <div>
                  <span className="px-2.5 py-1 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-black uppercase tracking-wider mb-2 inline-block shadow-md">
                    {videoSteps[currentStep].badge}
                  </span>
                  <h4 className="text-white text-sm sm:text-base font-extrabold drop-shadow">
                    {videoSteps[currentStep].title}
                  </h4>
                </div>
              </div>
            </div>

            {/* Right: Commercial Voiceover Script & Technical Highlights */}
            <div className="lg:col-span-5 flex flex-col justify-between p-5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-left">
              <div>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded bg-[var(--color-primary)]/15 text-[var(--color-primary)] uppercase tracking-wider mb-2 inline-block">
                  {videoSteps[currentStep].tag}
                </span>
                
                <h4 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                  Feature Breakdown / تفاصيل الخاصية
                </h4>
                <p className="text-xs text-[var(--color-text)] leading-relaxed mb-4">
                  {videoSteps[currentStep].description}
                </p>

                <div className="p-3.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-xs mb-2">
                  <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider block mb-1">
                    🎙️ Commercial Voiceover Script (English):
                  </span>
                  <p className="italic font-medium text-[var(--color-text)]">
                    {videoSteps[currentStep].script}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-xs" dir="rtl">
                  <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider block mb-1">
                    🎙️ النص الإعلاني الصوتي (باللغة العربية):
                  </span>
                  <p className="font-semibold text-[var(--color-text)]">
                    {videoSteps[currentStep].scriptAr}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Timeline Scrubber */}
          <div className="grid grid-cols-5 gap-2 pt-2">
            {videoSteps.map((step, idx) => (
              <div
                key={idx}
                onClick={() => { setCurrentStep(idx); setIsPlaying(false); }}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer text-left ${
                  currentStep === idx
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 shadow-sm'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)]/50 hover:bg-[var(--color-surface-offset)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono font-bold text-[var(--color-primary)]">
                    Scene {idx + 1}
                  </span>
                  {currentStep === idx && <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-ping" />}
                </div>
                <span className="text-[11px] font-bold text-[var(--color-text)] block truncate">
                  {step.tag}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Marketing Graphic Assets & Banners Gallery */}
      <div className="max-w-6xl mx-auto mb-16">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-2">
            Promotional Graphics &amp; Social Media Banners
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Ready-to-publish 4K campaign banners for Twitter, LinkedIn, Instagram, and web advertisements.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Banner 1: SaaS ERP Dashboard */}
          <div className="premium-card p-4 overflow-hidden group hover:border-[var(--color-primary)] transition-all">
            <div className="rounded-xl overflow-hidden border border-[var(--color-border)] bg-slate-950 mb-3">
              <img
                src="/qvoke_marketing_hero.jpg"
                alt="Qvoke SaaS ERP Dashboard Banner"
                className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-extrabold text-[var(--color-text)]">
                  Enterprise Dashboard &amp; ZATCA Invoice Mockup
                </h4>
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  16:9 4K resolution banner • Multi-device display
                </span>
              </div>
              <a
                href="/qvoke_marketing_hero.jpg"
                download="qvoke-dashboard-banner-4k.jpg"
                className="p-2 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-colors cursor-pointer"
                title="Download 4K Banner"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Banner 2: Mobile POS & Retail Billing */}
          <div className="premium-card p-4 overflow-hidden group hover:border-[var(--color-primary)] transition-all">
            <div className="rounded-xl overflow-hidden border border-[var(--color-border)] bg-slate-950 mb-3">
              <img
                src="/qvoke_mobile_pos.jpg"
                alt="Qvoke Mobile POS Banner"
                className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-extrabold text-[var(--color-text)]">
                  Handheld POS &amp; Mobile Billing Commercial Banner
                </h4>
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  16:9 4K resolution banner • Retail checkout mockup
                </span>
              </div>
              <a
                href="/qvoke_mobile_pos.jpg"
                download="qvoke-mobile-pos-banner-4k.jpg"
                className="p-2 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-colors cursor-pointer"
                title="Download 4K Banner"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Responsive Device Frame Mockups */}
      <div className="max-w-6xl mx-auto mb-16">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-2">
            Responsive Phone, Tablet &amp; Desktop Ergonomics
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Experience fluid layout scaling tailored for mobile field reps and warehouse POS stations.
          </p>

          {/* Device Switcher Pills */}
          <div className="inline-flex items-center gap-2 p-1.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] mt-4">
            <button
              onClick={() => setDeviceMode('desktop')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                deviceMode === 'desktop'
                  ? 'bg-[var(--color-primary)] text-white shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" /> Desktop (1920px)
            </button>
            <button
              onClick={() => setDeviceMode('tablet')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                deviceMode === 'tablet'
                  ? 'bg-[var(--color-primary)] text-white shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              <Tablet className="w-3.5 h-3.5" /> iPad Tablet (768px)
            </button>
            <button
              onClick={() => setDeviceMode('mobile')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                deviceMode === 'mobile'
                  ? 'bg-[var(--color-primary)] text-white shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" /> iPhone Mobile (390px)
            </button>
          </div>
        </div>

        {/* Scaled Mockup Window */}
        <div className="flex justify-center items-center overflow-x-auto pb-6">
          <div
            className={`transition-all duration-300 rounded-3xl border-4 border-slate-700 bg-slate-900 shadow-2xl p-4 overflow-hidden ${
              deviceMode === 'desktop'
                ? 'w-full max-w-4xl'
                : deviceMode === 'tablet'
                ? 'w-full max-w-2xl'
                : 'w-[360px]'
            }`}
          >
            {/* Mockup Top Window Controls */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800 text-[10px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="font-mono text-slate-500 ml-2">app.qvoke.com</span>
              </div>
              <span className="font-bold text-teal-400 font-mono">Saudi ZATCA Active</span>
            </div>

            {/* Mockup Screen Content Preview */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-left space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-teal-500 text-slate-950 flex items-center justify-center font-black text-xs">Q</div>
                  <span className="font-bold text-sm text-white">Qvoke Operational Console</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold uppercase">Online</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase">Today Revenue</span>
                  <span className="font-mono font-extrabold text-teal-400 text-base">42,850 SAR</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase">ZATCA QR Scanned</span>
                  <span className="font-mono font-extrabold text-white text-base">100% Phase 2</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                <span className="font-bold text-white block mb-1">Recent Activity Feed:</span>
                <p className="text-slate-400">• Quote QT-2026-0042 electronically signed by client Abdullah</p>
                <p className="text-slate-400">• POS retail invoice INV-2026-0091 posted &amp; stock auto-deducted</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Brand Identity & Theme Showcase Grid */}
      <div className="max-w-6xl mx-auto mb-16">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-2">
            Design Philosophy &amp; Theme Engine
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Explore 9 meticulously crafted aesthetic modes built for elite modern workflows.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {UI_THEMES.map((theme) => (
            <div
              key={theme.id}
              onClick={() => setUITheme(theme.id)}
              className="premium-card p-5 flex flex-col justify-between hover:border-[var(--color-primary)] transition-all cursor-pointer"
            >
              <div>
                <div className="flex items-center gap-1.5 mb-3">
                  {theme.swatches.map((c, i) => (
                    <span key={i} className="w-4 h-4 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <h3 className="text-sm font-extrabold text-[var(--color-text)] mb-0.5">{theme.name}</h3>
                <span className="text-xs font-bold text-[var(--color-text-muted)] block mb-2" dir="rtl">{theme.nameAr}</span>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{theme.description}</p>
              </div>
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-[var(--color-divider)]/40 text-[11px] font-bold text-[var(--color-primary)]">
                <span>Click to Preview Theme</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};