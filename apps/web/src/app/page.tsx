'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Linkedin, Globe, ChevronDown } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [selectedPlan, setSelectedPlan] = useState<'prepare' | 'apply' | 'interview'>('apply');

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    console.log('Contact form submitted:', contactForm);
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
        <div className="container flex h-[140px] items-center justify-between px-4 md:px-8">
          <Link href="/" className="flex items-center">
            <Image
              src="/Logo/Logo without bg/Full_Logo-removebg-preview.png"
              alt="SmartApply"
              width={241}
              height={247}
              className="w-[180px] md:w-[241px] h-auto"
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
          {/* Background Wave */}
          <div className="absolute inset-0 z-0">
            <svg className="absolute bottom-0 w-full" viewBox="0 0 1440 328" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
              <path d="M0 328V100C200 180 400 0 720 100C1040 200 1240 50 1440 100V328H0Z" fill="#E5EEFD" fillOpacity="0.3"/>
            </svg>
          </div>
          
          <div className="container relative z-10 px-4 md:px-8">
            <div className="flex flex-col lg:flex-row gap-8 justify-center items-stretch">
              {/* PREPARE Plan */}
              <div 
                onClick={() => setSelectedPlan('prepare')}
                className={`relative rounded-3xl p-8 w-full max-w-[420px] mx-auto lg:mx-0 shadow-[5px_10px_4px_rgba(27,42,73,0.25)] flex flex-col min-h-[680px] cursor-pointer transition-all duration-300 ${
                  selectedPlan === 'prepare' ? 'bg-[#1B2A49]' : 'bg-[#E5EEFD]'
                }`}
              >
                <div className="text-center mb-8">
                  <h3 className={`font-poppins font-semibold text-3xl md:text-4xl mb-2 transition-colors duration-300 ${
                    selectedPlan === 'prepare' ? 'text-[#E5EEFD]' : 'text-[#1B2A49]'
                  }`}>PREPARE</h3>
                  <p className={`font-poppins font-medium text-lg md:text-xl transition-colors duration-300 ${
                    selectedPlan === 'prepare' ? 'text-white' : 'text-black'
                  }`}>(Kostenlos)</p>
                </div>
                <ul className={`flex-1 space-y-4 font-poppins text-base md:text-lg transition-colors duration-300 ${
                  selectedPlan === 'prepare' ? 'text-white' : 'text-[#1B2A49]'
                }`}>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'prepare' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>Profil erstellen und verwalten</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'prepare' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>Bis zu 5 Bewerbungen verfolgen</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'prepare' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>Basis-Lebenslauf-Vorlagen</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'prepare' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>E-Mail-Support</span>
                  </li>
                </ul>
                <div className="mt-8 flex justify-center">
                  <Button 
                    onClick={(e) => { e.stopPropagation(); router.push('/register'); }}
                    className={`font-poppins font-semibold text-lg md:text-xl px-12 py-6 rounded-xl shadow-[0px_4px_4px_rgba(0,0,0,0.25)] transition-colors ${
                      selectedPlan === 'prepare' 
                        ? 'bg-white text-[#1B2A49] hover:bg-gray-100' 
                        : 'bg-[#1B2A49] text-white hover:bg-[#2a3d66]'
                    }`}
                  >
                    Jetzt testen
                  </Button>
                </div>
              </div>

              {/* APPLY Plan */}
              <div 
                onClick={() => setSelectedPlan('apply')}
                className={`relative rounded-3xl p-8 w-full max-w-[420px] mx-auto lg:mx-0 flex flex-col min-h-[685px] cursor-pointer transition-all duration-300 ${
                  selectedPlan === 'apply' ? 'bg-[#1B2A49]' : 'bg-[#E5EEFD] shadow-[5px_10px_4px_rgba(27,42,73,0.25)]'
                }`}
              >
                {/* Most Popular Badge - always visible on APPLY */}
                <div className="absolute -top-2 -right-2 md:top-0 md:right-0 overflow-hidden w-[150px] h-[150px]">
                  <div className="absolute top-[40px] right-[-35px] bg-[#E5EEFD] text-black font-poppins font-bold text-sm py-2 px-10 transform rotate-45 shadow-md">
                    Beliebteste
                  </div>
                </div>
                
                <div className="text-center mb-8">
                  <h3 className={`font-poppins font-semibold text-3xl md:text-4xl mb-2 transition-colors duration-300 ${
                    selectedPlan === 'apply' ? 'text-[#E5EEFD]' : 'text-[#1B2A49]'
                  }`}>APPLY</h3>
                  <p className={`font-poppins font-medium text-lg md:text-xl transition-colors duration-300 ${
                    selectedPlan === 'apply' ? 'text-white' : 'text-black'
                  }`}>(9,90 €/ Monat)</p>
                </div>
                <ul className={`flex-1 space-y-4 font-poppins text-base md:text-lg transition-colors duration-300 ${
                  selectedPlan === 'apply' ? 'text-white' : 'text-[#1B2A49]'
                }`}>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'apply' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>Alles aus PREPARE</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'apply' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>Unbegrenzte Bewerbungen</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'apply' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>KI-gestützte Lebenslauf- und Anschreiben-Erstellung</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'apply' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>Erweitertes Analyse-Dashboard</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'apply' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>Prioritäts-Support</span>
                  </li>
                </ul>
                <div className="mt-8 flex justify-center">
                  <Button 
                    onClick={(e) => { e.stopPropagation(); router.push('/register'); }}
                    className={`font-poppins font-semibold text-lg md:text-xl px-12 py-6 rounded-xl shadow-[0px_4px_4px_rgba(0,0,0,0.25)] transition-colors ${
                      selectedPlan === 'apply' 
                        ? 'bg-white text-[#1B2A49] hover:bg-gray-100' 
                        : 'bg-[#1B2A49] text-white hover:bg-[#2a3d66]'
                    }`}
                  >
                    Upgraden
                  </Button>
                </div>
              </div>

              {/* INTERVIEW Plan */}
              <div 
                onClick={() => setSelectedPlan('interview')}
                className={`relative rounded-3xl p-8 w-full max-w-[420px] mx-auto lg:mx-0 flex flex-col min-h-[685px] cursor-pointer transition-all duration-300 ${
                  selectedPlan === 'interview' ? 'bg-[#1B2A49]' : 'bg-[#E5EEFD] shadow-[5px_10px_4px_rgba(27,42,73,0.25)]'
                }`}
              >
                <div className="text-center mb-8">
                  <h3 className={`font-poppins font-semibold text-3xl md:text-4xl mb-2 transition-colors duration-300 ${
                    selectedPlan === 'interview' ? 'text-[#E5EEFD]' : 'text-[#1B2A49]'
                  }`}>INTERVIEW</h3>
                  <p className={`font-poppins font-medium text-lg md:text-xl transition-colors duration-300 ${
                    selectedPlan === 'interview' ? 'text-white' : 'text-black'
                  }`}>(19,90 €/ Monat)</p>
                </div>
                <ul className={`flex-1 space-y-4 font-poppins text-base md:text-lg transition-colors duration-300 ${
                  selectedPlan === 'interview' ? 'text-white' : 'text-[#1B2A49]'
                }`}>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'interview' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>Alles aus APPLY</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'interview' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>KI Interview-Coach</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'interview' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>Übungs-Interviews</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'interview' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>Personalisiertes Feedback</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'interview' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>Branchenspezifische Vorbereitung</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 ${selectedPlan === 'interview' ? 'text-green-400' : 'text-green-600'}`}>✓</span>
                    <span>24/7 Premium-Support</span>
                  </li>
                </ul>
                <div className="mt-8 flex justify-center">
                  <Button 
                    onClick={(e) => { e.stopPropagation(); router.push('/register'); }}
                    className={`font-poppins font-semibold text-lg md:text-xl px-12 py-6 rounded-xl shadow-[0px_4px_4px_rgba(0,0,0,0.25)] transition-colors ${
                      selectedPlan === 'interview' 
                        ? 'bg-white text-[#1B2A49] hover:bg-gray-100' 
                        : 'bg-[#1B2A49] text-white hover:bg-[#2a3d66]'
                    }`}
                  >
                    Upgraden
                  </Button>
                </div>
              </div>
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
                    className="w-full bg-transparent border-2 border-[#E5EEFD] rounded-xl px-4 py-2 text-white placeholder-white/70 font-poppins focus:outline-none focus:border-white"
                  />
                </div>
                
                <div>
                  <label className="font-poppins font-semibold text-lg text-white block mb-2">E-Mail</label>
                  <input
                    type="email"
                    placeholder="Deine E-Mail"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full bg-transparent border-2 border-[#E5EEFD] rounded-xl px-4 py-2 text-white placeholder-white/70 font-poppins focus:outline-none focus:border-white"
                  />
                </div>
                
                <div>
                  <label className="font-poppins font-semibold text-lg text-white block mb-2">Nachricht</label>
                  <textarea
                    placeholder="Deine Nachricht"
                    rows={4}
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    className="w-full bg-transparent border-2 border-[#E5EEFD] rounded-xl px-4 py-2 text-white placeholder-white/70 font-poppins focus:outline-none focus:border-white resize-none"
                  />
                </div>
                
                <div className="flex justify-end">
                  <Button 
                    type="submit"
                    className="bg-white text-[#1B2A49] font-poppins font-semibold text-lg md:text-xl px-12 py-6 rounded-xl shadow-[0px_4px_4px_rgba(0,0,0,0.25)] hover:bg-gray-100 transition-colors"
                  >
                    Senden
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
                Copyright © 2025 SmartApply
              </p>
              
              <div className="flex items-center gap-6 md:gap-12">
                <a href="#" className="font-poppins font-semibold text-sm md:text-xl hover:opacity-70 transition-opacity">
                  Datenschutz
                </a>
                <a href="#" className="font-poppins font-semibold text-sm md:text-xl hover:opacity-70 transition-opacity">
                  AGB
                </a>
                <a href="#" className="font-poppins font-semibold text-sm md:text-xl hover:opacity-70 transition-opacity">
                  Impressum
                </a>
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
