'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Linkedin, Globe, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

export default function Home() {
  const router = useRouter();
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'pro' | 'premium'>('pro');

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Lightweight client-side guards. The backend re-validates with
    // class-validator (length, email shape) and throttles per IP, so
    // these only exist to give immediate feedback.
    const name = contactForm.name.trim();
    const email = contactForm.email.trim();
    const message = contactForm.message.trim();
    if (!name || !email || message.length < 10) {
      toast.error('Bitte fülle alle Felder aus (Nachricht mindestens 10 Zeichen).');
      return;
    }

    setIsSubmittingContact(true);
    try {
      const response = await api.contact.submit({ name, email, message });
      if (response.ok) {
        toast.success(response.message);
        setContactForm({ name: '', email: '', message: '' });
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      const { ApiError, getErrorMessage } = await import('@/lib/errors');
      if (ApiError.isApiError(error)) {
        toast.error(getErrorMessage(error));
      } else {
        toast.error('Nachricht konnte nicht gesendet werden. Bitte versuche es später erneut.');
      }
    } finally {
      setIsSubmittingContact(false);
    }
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#FFFFFE]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container flex h-[80px] items-center justify-between px-4 md:px-8">
          <Link href="/" className="flex items-center">
            <Image
              src="/Logo/Logo without bg/Full_Logo-removebg-preview.png"
              alt="SmartApply"
              width={241}
              height={247}
              className="w-[120px] md:w-[160px] h-auto"
              priority
            />
          </Link>
          
          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-10 font-poppins text-lg text-[#1B2A49]">
            <button onClick={() => scrollToSection('hero')} className="hover:opacity-70 transition-opacity">
              Start
            </button>
            <button onClick={() => scrollToSection('about')} className="hover:opacity-70 transition-opacity">
              Über uns
            </button>
            <button onClick={() => scrollToSection('pricing')} className="hover:opacity-70 transition-opacity">
              Preise
            </button>
            <button onClick={() => scrollToSection('contact')} className="hover:opacity-70 transition-opacity">
              Kontakt
            </button>
          </nav>

          {/* Auth Buttons */}
          <div className="flex items-center gap-3">
            <Button 
              variant="outline"
              onClick={() => router.push('/login')}
              className="font-poppins font-semibold text-sm md:text-base px-4 md:px-6 py-2 border-2 border-[#1B2A49] text-[#1B2A49] bg-transparent hover:bg-[#1B2A49] hover:text-white transition-colors rounded-lg"
            >
              Anmelden
            </Button>
            <Button 
              onClick={() => router.push('/register')}
              className="font-poppins font-semibold text-sm md:text-base px-4 md:px-6 py-2 bg-[#1B2A49] text-white hover:bg-[#2a3d66] transition-colors rounded-lg"
            >
              Registrieren
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section id="hero" className="container px-4 md:px-8 py-8 md:py-12">
          <div className="max-w-[976px] mx-auto flex flex-col items-center gap-4">
            <h1 className="font-poppins font-bold text-3xl md:text-5xl text-[#1B2A49] text-center">
              Willkommen bei SmartApply
            </h1>
            <p className="font-poppins font-semibold text-xl md:text-3xl text-[#1B2A49] text-center">
              wo Bewerbungen zum System werden
            </p>
            <div className="w-full mt-4">
              <Image
                src="/Images/Hero Image.png"
                alt="Hero Image - Person working on laptop"
                width={976}
                height={651}
                className="w-full h-auto rounded-lg"
                priority
              />
            </div>
            <div className="w-full max-w-[900px] h-[2px] bg-[#1B2A49] mt-4" />
          </div>
        </section>

        {/* About Section */}
        <section id="about" className="container px-4 md:px-8 py-12 md:py-20">
          <div className="flex flex-col lg:flex-row gap-12 items-center">
            {/* Feature Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 md:gap-12 max-w-[762px]">
              {/* Card 1 - Apply in minutes */}
              <div className="bg-[#E5EEFD] rounded-3xl p-6 shadow-[0px_4px_4px_rgba(27,42,73,0.25)] min-h-[276px] flex flex-col">
                <div className="flex justify-center mb-4">
                  <Image
                    src="/Icons/IconApply.png"
                    alt="Apply icon"
                    width={110}
                    height={110}
                    className="w-[80px] md:w-[110px] h-auto"
                  />
                </div>
                <p className="font-poppins text-lg md:text-2xl">
                  <span className="font-bold text-[#1B2A49]">Bewerben in Minuten.</span>
                  <span className="font-semibold text-black"> Lass KI deinen Lebenslauf und dein Anschreiben automatisch anpassen.</span>
                </p>
              </div>

              {/* Card 2 - Dashboard */}
              <div className="bg-[#E5EEFD] rounded-3xl p-6 shadow-[0px_4px_4px_rgba(27,42,73,0.25)] min-h-[276px] flex flex-col">
                <div className="flex justify-center mb-4">
                  <Image
                    src="/Icons/IconDashboard.png"
                    alt="Dashboard icon"
                    width={100}
                    height={100}
                    className="w-[70px] md:w-[100px] h-auto"
                  />
                </div>
                <p className="font-poppins text-lg md:text-2xl">
                  <span className="font-bold text-[#1B2A49]">Ein Dashboard für alle Bewerbungen. </span>
                  <span className="font-semibold text-black">Behalte jede Bewerbung im Blick.</span>
                </p>
              </div>

              {/* Card 3 - Data */}
              <div className="bg-[#E5EEFD] rounded-3xl p-6 shadow-[0px_4px_4px_rgba(27,42,73,0.25)] min-h-[276px] flex flex-col">
                <div className="flex justify-center mb-4">
                  <Image
                    src="/Icons/IconData.png"
                    alt="Analytics icon"
                    width={100}
                    height={100}
                    className="w-[70px] md:w-[100px] h-auto"
                  />
                </div>
                <p className="font-poppins text-lg md:text-2xl">
                  <span className="font-bold text-[#1B2A49]">Nutze Daten, nicht Vermutungen. </span>
                  <span className="font-semibold text-black">Sieh, welche Bewerbungen am besten funktionieren und verbessere dich stetig.</span>
                </p>
              </div>

              {/* Card 4 - Interview */}
              <div className="bg-[#E5EEFD] rounded-3xl p-6 shadow-[0px_4px_4px_rgba(27,42,73,0.25)] min-h-[276px] flex flex-col">
                <div className="flex justify-center mb-4">
                  <Image
                    src="/Icons/IconSupport.png"
                    alt="Interview icon"
                    width={110}
                    height={110}
                    className="w-[80px] md:w-[110px] h-auto"
                  />
                </div>
                <p className="font-poppins text-lg md:text-2xl">
                  <span className="font-bold text-[#1B2A49]">Unterstützung fürs Vorstellungsgespräch. </span>
                  <span className="font-semibold text-black">Übe mit dem Interview-Coach für dein nächstes Bewerbungsgespräch.</span>
                </p>
              </div>
            </div>

            {/* About Us Illustration */}
            <div className="hidden lg:block">
              <Image
                src="/Images/AboutUS.png"
                alt="About us illustration"
                width={553}
                height={553}
                className="w-[400px] xl:w-[553px] h-auto"
              />
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="relative py-16 md:py-24 overflow-hidden">
          {/* SVG Background - Behind the cards */}
          <div className="absolute inset-0 z-0 flex items-center justify-center">
            <svg width="1440" height="328" viewBox="0 0 1440 328" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
              <path d="M1440 327.692L1405.6 324.051C1371.2 320.41 1302.4 313.128 1233.92 296.088C1165.28 279.194 1097.12 252.396 1028.48 239.143C960 225.744 891.2 225.744 822.72 241.036C754.08 256.328 685.92 286.913 617.28 291.282C548.8 295.651 480 273.805 411.52 271.621C342.88 269.436 274.72 286.913 206.08 299.001C137.6 311.235 68.7999 317.934 34.4 321.43L0 324.78V9.15527e-05H34.4C68.7999 9.15527e-05 137.6 9.15527e-05 206.08 9.15527e-05C274.72 9.15527e-05 342.88 9.15527e-05 411.52 9.15527e-05C480 9.15527e-05 548.8 9.15527e-05 617.28 9.15527e-05C685.92 9.15527e-05 754.08 9.15527e-05 822.72 9.15527e-05C891.2 9.15527e-05 960 9.15527e-05 1028.48 9.15527e-05C1097.12 9.15527e-05 1165.28 9.15527e-05 1233.92 9.15527e-05C1302.4 9.15527e-05 1371.2 9.15527e-05 1405.6 9.15527e-05H1440V327.692Z" fill="#1B2A49"/>
              <path d="M1440 240.308L1405.6 239.58C1371.2 238.851 1302.4 237.395 1233.92 229.093C1165.28 220.938 1097.12 205.791 1028.48 196.179C960 186.421 891.2 182.051 822.72 183.508C754.08 184.964 685.92 192.246 617.28 195.887C548.8 199.528 480 199.528 411.52 203.898C342.88 208.267 274.72 217.005 206.08 222.831C137.6 228.657 68.7999 231.569 34.4 233.026L0 234.482V0.000167847H34.4C68.7999 0.000167847 137.6 0.000167847 206.08 0.000167847C274.72 0.000167847 342.88 0.000167847 411.52 0.000167847C480 0.000167847 548.8 0.000167847 617.28 0.000167847C685.92 0.000167847 754.08 0.000167847 822.72 0.000167847C891.2 0.000167847 960 0.000167847 1028.48 0.000167847C1097.12 0.000167847 1165.28 0.000167847 1233.92 0.000167847C1302.4 0.000167847 1371.2 0.000167847 1405.6 0.000167847H1440V240.308Z" fill="#495573"/>
              <path d="M1440 166.031L1405.6 161.953C1371.2 157.729 1302.4 149.574 1233.92 155.108C1165.28 160.642 1097.12 180.158 1028.48 185.401C960 190.79 891.2 182.052 822.72 177.974C754.08 173.75 685.92 174.333 617.28 175.061C548.8 175.789 480 176.663 411.52 185.401C342.88 194.14 274.72 210.743 206.08 209.723C137.6 208.704 68.7999 190.353 34.4 181.032L0 171.857V0.000244141H34.4C68.7999 0.000244141 137.6 0.000244141 206.08 0.000244141C274.72 0.000244141 342.88 0.000244141 411.52 0.000244141C480 0.000244141 548.8 0.000244141 617.28 0.000244141C685.92 0.000244141 754.08 0.000244141 822.72 0.000244141C891.2 0.000244141 960 0.000244141 1028.48 0.000244141C1097.12 0.000244141 1165.28 0.000244141 1233.92 0.000244141C1302.4 0.000244141 1371.2 0.000244141 1405.6 0.000244141H1440V166.031Z" fill="#7A859F"/>
              <path d="M1440 167.487L1405.6 162.827C1371.2 158.312 1302.4 148.991 1233.92 137.339C1165.28 125.688 1097.12 111.707 1028.48 106.609C960 101.512 891.2 105.298 822.72 114.62C754.08 123.795 685.92 138.359 617.28 143.456C548.8 148.554 480 144.185 411.52 138.796C342.88 133.553 274.72 127.145 206.08 120.591C137.6 114.037 68.7999 107.337 34.4 103.842L0 100.492V0H34.4C68.7999 0 137.6 0 206.08 0C274.72 0 342.88 0 411.52 0C480 0 548.8 0 617.28 0C685.92 0 754.08 0 822.72 0C891.2 0 960 0 1028.48 0C1097.12 0 1165.28 0 1233.92 0C1302.4 0 1371.2 0 1405.6 0H1440V167.487Z" fill="#AEB8CD"/>
              <path d="M1440 53.8872L1405.6 58.6933C1371.2 63.6451 1302.4 73.2575 1233.92 82.5785C1165.28 91.7539 1097.12 100.492 1028.48 95.6862C960 90.7344 891.2 72.3836 822.72 64.8103C754.08 57.2369 685.92 60.7323 617.28 68.0144C548.8 75.2964 480 86.3651 411.52 82.7241C342.88 79.0831 274.72 60.7323 206.08 61.4605C137.6 62.1888 68.7999 81.9959 34.4 92.0452L0 101.949V1.52588e-05H34.4C68.7999 1.52588e-05 137.6 1.52588e-05 206.08 1.52588e-05C274.72 1.52588e-05 342.88 1.52588e-05 411.52 1.52588e-05C480 1.52588e-05 548.8 1.52588e-05 617.28 1.52588e-05C685.92 1.52588e-05 754.08 1.52588e-05 822.72 1.52588e-05C891.2 1.52588e-05 960 1.52588e-05 1028.48 1.52588e-05C1097.12 1.52588e-05 1165.28 1.52588e-05 1233.92 1.52588e-05C1302.4 1.52588e-05 1371.2 1.52588e-05 1405.6 1.52588e-05H1440V53.8872Z" fill="#FFFFFD" fillOpacity="0.992157"/>
            </svg>
          </div>

          <div className="container relative z-10 px-4 md:px-8">
            {/* Section header — value-oriented framing */}
            <div className="mx-auto mb-12 max-w-3xl text-center">
              <h2 className="font-poppins font-semibold text-3xl md:text-4xl text-[#1B2A49] mb-3">
                Wähle deinen Weg zum nächsten Job
              </h2>
              <p className="font-poppins text-base md:text-lg text-[#1B2A49]/80">
                Vom risikofreien Einstieg bis zur vollautomatisierten Jobsuche —
                transparent, monatlich kündbar, ohne versteckte Kosten.
              </p>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 justify-center items-stretch">
              {/* FREE Plan — risikofreier Einstieg */}
              <div
                onClick={() => setSelectedPlan('free')}
                className={`relative rounded-3xl p-8 w-full max-w-[420px] mx-auto lg:mx-0 flex flex-col min-h-[680px] cursor-pointer transition-all duration-300 ${
                  selectedPlan === 'free' ? 'bg-[#1B2A49]' : 'bg-[#E5EEFD] shadow-[5px_10px_4px_rgba(27,42,73,0.25)]'
                }`}
              >
                <div className="text-center mb-8">
                  <h3 className={`font-poppins font-semibold text-3xl md:text-4xl mb-1 transition-colors duration-300 ${
                    selectedPlan === 'free' ? 'text-[#E5EEFD]' : 'text-[#1B2A49]'
                  }`}>Free</h3>
                  <p className={`font-poppins text-sm md:text-base mb-4 transition-colors duration-300 ${
                    selectedPlan === 'free' ? 'text-white/80' : 'text-[#1B2A49]/70'
                  }`}>
                    Smart Apply risikofrei testen
                  </p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className={`font-poppins font-bold text-4xl md:text-5xl transition-colors duration-300 ${
                      selectedPlan === 'free' ? 'text-white' : 'text-[#1B2A49]'
                    }`}>0 €</span>
                    <span className={`font-poppins text-base transition-colors duration-300 ${
                      selectedPlan === 'free' ? 'text-white/70' : 'text-[#1B2A49]/60'
                    }`}>/Monat</span>
                  </div>
                </div>
                <ul className={`flex-1 space-y-4 font-poppins text-base md:text-lg transition-colors duration-300 ${
                  selectedPlan === 'free' ? 'text-white' : 'text-[#1B2A49]'
                }`}>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'free' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>3 Bewerbungen pro Monat</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'free' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>ATS-Score für jede Bewerbung</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'free' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>Übersichtliches Bewerbungstracking</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'free' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>Keine Kreditkarte erforderlich</span>
                  </li>
                </ul>
                <div className="mt-8 flex justify-center">
                  <Button
                    onClick={(e) => { e.stopPropagation(); router.push('/register'); }}
                    className={`font-poppins font-semibold text-lg md:text-xl px-12 py-6 rounded-xl shadow-[0px_4px_4px_rgba(0,0,0,0.25)] transition-colors ${
                      selectedPlan === 'free'
                        ? 'bg-white text-[#1B2A49] hover:bg-gray-100'
                        : 'bg-[#1B2A49] text-white hover:bg-[#2a3d66]'
                    }`}
                  >
                    Kostenlos starten
                  </Button>
                </div>
              </div>

              {/* PRO Plan — bessere Bewerbungen schreiben */}
              <div
                onClick={() => setSelectedPlan('pro')}
                className={`relative rounded-3xl p-8 w-full max-w-[420px] mx-auto lg:mx-0 flex flex-col min-h-[685px] cursor-pointer transition-all duration-300 ${
                  selectedPlan === 'pro' ? 'bg-[#1B2A49]' : 'bg-[#E5EEFD] shadow-[5px_10px_4px_rgba(27,42,73,0.25)]'
                }`}
              >
                <div className="text-center mb-8">
                  <h3 className={`font-poppins font-semibold text-3xl md:text-4xl mb-1 transition-colors duration-300 ${
                    selectedPlan === 'pro' ? 'text-[#E5EEFD]' : 'text-[#1B2A49]'
                  }`}>Pro</h3>
                  <p className={`font-poppins text-sm md:text-base mb-4 transition-colors duration-300 ${
                    selectedPlan === 'pro' ? 'text-white/80' : 'text-[#1B2A49]/70'
                  }`}>
                    Bessere Bewerbungen, mehr Interviews
                  </p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className={`font-poppins font-bold text-4xl md:text-5xl transition-colors duration-300 ${
                      selectedPlan === 'pro' ? 'text-white' : 'text-[#1B2A49]'
                    }`}>9,99 €</span>
                    <span className={`font-poppins text-base transition-colors duration-300 ${
                      selectedPlan === 'pro' ? 'text-white/70' : 'text-[#1B2A49]/60'
                    }`}>/Monat</span>
                  </div>
                </div>
                <ul className={`flex-1 space-y-4 font-poppins text-base md:text-lg transition-colors duration-300 ${
                  selectedPlan === 'pro' ? 'text-white' : 'text-[#1B2A49]'
                }`}>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'pro' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>KI-generierte Lebensläufe & Anschreiben</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'pro' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>Mehrere professionelle Templates</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'pro' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>ATS-Optimierung & Keyword-Matching</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'pro' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>Bewerbungstracking mit Statusverlauf</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'pro' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>Analytics: ATS-Score, Keyword-Score, Match-Insights</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'pro' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>Zugang zur integrierten Jobsuche</span>
                  </li>
                </ul>
                <div className="mt-8 flex justify-center">
                  <Button
                    onClick={(e) => { e.stopPropagation(); router.push('/register'); }}
                    className={`font-poppins font-semibold text-lg md:text-xl px-12 py-6 rounded-xl shadow-[0px_4px_4px_rgba(0,0,0,0.25)] transition-colors ${
                      selectedPlan === 'pro'
                        ? 'bg-white text-[#1B2A49] hover:bg-gray-100'
                        : 'bg-[#1B2A49] text-white hover:bg-[#2a3d66]'
                    }`}
                  >
                    Upgrade auf Pro
                  </Button>
                </div>
              </div>

              {/* PREMIUM Plan — Jobsuche automatisieren (recommended) */}
              <div
                onClick={() => setSelectedPlan('premium')}
                className={`relative rounded-3xl p-8 w-full max-w-[420px] mx-auto lg:mx-0 flex flex-col min-h-[685px] cursor-pointer transition-all duration-300 ring-2 ring-offset-2 ring-offset-transparent ${
                  selectedPlan === 'premium'
                    ? 'bg-[#1B2A49] ring-[#1B2A49]'
                    : 'bg-[#E5EEFD] shadow-[5px_10px_4px_rgba(27,42,73,0.25)] ring-[#1B2A49]/40'
                }`}
              >
                {/* Recommended ribbon — restrained, value-focused */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <span className={`inline-block font-poppins font-semibold text-xs md:text-sm uppercase tracking-wide px-4 py-1.5 rounded-full shadow-md whitespace-nowrap transition-colors duration-300 ${
                    selectedPlan === 'premium' ? 'bg-[#E5EEFD] text-[#1B2A49]' : 'bg-[#1B2A49] text-[#E5EEFD]'
                  }`}>
                    Beste Wahl für aktive Jobsuche
                  </span>
                </div>

                <div className="text-center mb-8">
                  <h3 className={`font-poppins font-semibold text-3xl md:text-4xl mb-1 transition-colors duration-300 ${
                    selectedPlan === 'premium' ? 'text-[#E5EEFD]' : 'text-[#1B2A49]'
                  }`}>Premium</h3>
                  <p className={`font-poppins text-sm md:text-base mb-4 transition-colors duration-300 ${
                    selectedPlan === 'premium' ? 'text-white/80' : 'text-[#1B2A49]/70'
                  }`}>
                    Deine Jobsuche läuft auf Autopilot
                  </p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className={`font-poppins font-bold text-4xl md:text-5xl transition-colors duration-300 ${
                      selectedPlan === 'premium' ? 'text-white' : 'text-[#1B2A49]'
                    }`}>19,99 €</span>
                    <span className={`font-poppins text-base transition-colors duration-300 ${
                      selectedPlan === 'premium' ? 'text-white/70' : 'text-[#1B2A49]/60'
                    }`}>/Monat</span>
                  </div>
                </div>
                <ul className={`flex-1 space-y-4 font-poppins text-base md:text-lg transition-colors duration-300 ${
                  selectedPlan === 'premium' ? 'text-white' : 'text-[#1B2A49]'
                }`}>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'premium' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>Alles aus Pro</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'premium' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span><span className="font-semibold">Auto-Apply Agent</span> — bewirbt sich für dich</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'premium' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>Automatisches Tracking per E-Mail-Erkennung</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'premium' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>KI Interview-Coach für die Vorbereitung</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'premium' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>Erweiterte Analytics & Trends</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'premium' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>Priorisierte Generierung & Premium-Support</span>
                  </li>
                </ul>
                <div className="mt-8 flex justify-center">
                  <Button
                    onClick={(e) => { e.stopPropagation(); router.push('/register'); }}
                    className={`font-poppins font-semibold text-lg md:text-xl px-12 py-6 rounded-xl shadow-[0px_4px_4px_rgba(0,0,0,0.25)] transition-colors ${
                      selectedPlan === 'premium'
                        ? 'bg-white text-[#1B2A49] hover:bg-gray-100'
                        : 'bg-[#1B2A49] text-white hover:bg-[#2a3d66]'
                    }`}
                  >
                    Premium freischalten
                  </Button>
                </div>
              </div>
            </div>

            {/* Trust microcopy — under the cards */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-poppins text-sm md:text-base text-[#1B2A49]/80">
              <span className="inline-flex items-center gap-2">
                <span className="text-green-600">✓</span> Transparente Monatspreise
              </span>
              <span className="hidden md:inline text-[#1B2A49]/30">·</span>
              <span className="inline-flex items-center gap-2">
                <span className="text-green-600">✓</span> Jederzeit kündbar
              </span>
              <span className="hidden md:inline text-[#1B2A49]/30">·</span>
              <span className="inline-flex items-center gap-2">
                <span className="text-green-600">✓</span> Keine versteckten Kosten
              </span>
              <span className="hidden md:inline text-[#1B2A49]/30">·</span>
              <span className="inline-flex items-center gap-2">
                <span className="text-green-600">✓</span> Für echte Jobsuchende gemacht
              </span>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="container px-4 md:px-8 py-16 md:py-24">
          <h2 className="font-poppins font-semibold text-3xl md:text-4xl text-[#1B2A49] mb-8 text-center lg:text-left">
            Kontaktiere uns
          </h2>
          
          <div className="flex flex-col lg:flex-row gap-8 justify-center items-stretch">
            {/* Contact Info Box */}
            <div className="bg-[#E5EEFD] rounded-[42px] p-8 w-full lg:w-[360px] flex-shrink-0">
              <div className="mb-8">
                <h4 className="font-poppins font-semibold text-lg text-[#1B2A49] mb-2">Adresse</h4>
                <p className="font-poppins text-base text-black">Kommt bald...</p>
              </div>
              
              <div className="mb-8">
                <h4 className="font-poppins font-semibold text-lg text-[#1B2A49] mb-2">E-Mail</h4>
                <p className="font-poppins font-semibold text-lg text-black">smartapply@info.com</p>
              </div>
              
              <div>
                <h4 className="font-poppins font-semibold text-lg text-[#1B2A49] mb-4">Folge uns</h4>
                <div className="flex gap-4">
                  <a href="#" className="w-11 h-11 rounded-full bg-[#0077B5] flex items-center justify-center hover:opacity-80 transition-opacity">
                    <Linkedin className="w-6 h-6 text-white" />
                  </a>
                  <a href="#" className="w-11 h-11 rounded-full bg-black flex items-center justify-center hover:opacity-80 transition-opacity">
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </a>
                  <a href="#" className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center hover:opacity-80 transition-opacity">
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </a>
                  <a href="#" className="w-11 h-11 rounded-full bg-black flex items-center justify-center hover:opacity-80 transition-opacity">
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-[#1B2A49] rounded-[42px] p-8 w-full lg:flex-1 max-w-[812px]">
              <form onSubmit={handleContactSubmit} className="space-y-6">
                <div>
                  <label className="font-poppins font-semibold text-lg text-white block mb-2">Name</label>
                  <input
                    type="text"
                    placeholder="Dein Name"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    required
                    minLength={1}
                    maxLength={100}
                    disabled={isSubmittingContact}
                    className="w-full bg-transparent border-2 border-[#E5EEFD] rounded-xl px-4 py-2 text-white placeholder-white/70 font-poppins focus:outline-none focus:border-white disabled:opacity-60"
                  />
                </div>
                
                <div>
                  <label className="font-poppins font-semibold text-lg text-white block mb-2">E-Mail</label>
                  <input
                    type="email"
                    placeholder="Deine E-Mail"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    required
                    maxLength={254}
                    disabled={isSubmittingContact}
                    className="w-full bg-transparent border-2 border-[#E5EEFD] rounded-xl px-4 py-2 text-white placeholder-white/70 font-poppins focus:outline-none focus:border-white disabled:opacity-60"
                  />
                </div>
                
                <div>
                  <label className="font-poppins font-semibold text-lg text-white block mb-2">Nachricht</label>
                  <textarea
                    placeholder="Deine Nachricht"
                    rows={4}
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    required
                    minLength={10}
                    maxLength={5000}
                    disabled={isSubmittingContact}
                    className="w-full bg-transparent border-2 border-[#E5EEFD] rounded-xl px-4 py-2 text-white placeholder-white/70 font-poppins focus:outline-none focus:border-white resize-none disabled:opacity-60"
                  />
                </div>
                
                <div className="flex justify-end">
                  <Button 
                    type="submit"
                    disabled={isSubmittingContact}
                    className="bg-white text-[#1B2A49] font-poppins font-semibold text-lg md:text-xl px-12 py-6 rounded-xl shadow-[0px_4px_4px_rgba(0,0,0,0.25)] hover:bg-gray-100 transition-colors disabled:opacity-70"
                  >
                    {isSubmittingContact ? 'Senden…' : 'Senden'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative">
        {/* Wave Background */}
        <div className="relative h-[200px] md:h-[300px]">
          <svg className="absolute bottom-0 w-full h-full" viewBox="0 0 1440 300" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <path d="M0 150C200 50 400 200 720 150C1040 100 1240 200 1440 100V300H0V150Z" fill="#1B2A49" fillOpacity="0.3"/>
            <path d="M0 200C200 100 400 250 720 200C1040 150 1240 250 1440 150V300H0V200Z" fill="#1B2A49" fillOpacity="0.5"/>
            <path d="M0 250C200 150 400 280 720 230C1040 180 1240 280 1440 200V300H0V250Z" fill="#1B2A49"/>
          </svg>
        </div>
        
        {/* Footer Content */}
        <div className="bg-[#1B2A49] py-6">
          <div className="container px-4 md:px-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-white">
              <p className="font-poppins font-semibold text-sm md:text-xl">
                Copyright © {new Date().getFullYear()} SmartApply
              </p>
              
              <div className="flex items-center gap-6 md:gap-12">
                <Link href="/faq" className="font-poppins font-semibold text-sm md:text-xl hover:opacity-70 transition-opacity">
                  FAQ
                </Link>
                <Link href="/datenschutz" className="font-poppins font-semibold text-sm md:text-xl hover:opacity-70 transition-opacity">
                  Datenschutz
                </Link>
                <Link href="/agb" className="font-poppins font-semibold text-sm md:text-xl hover:opacity-70 transition-opacity">
                  AGB
                </Link>
                <Link href="/impressum" className="font-poppins font-semibold text-sm md:text-xl hover:opacity-70 transition-opacity">
                  Impressum
                </Link>
              </div>
              
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 md:w-6 md:h-6" />
                <span className="font-poppins font-semibold text-sm md:text-xl">Deutsch</span>
                <ChevronDown className="w-3 h-3 md:w-4 md:h-4" />
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
