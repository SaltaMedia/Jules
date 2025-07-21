'use client';
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#7f7fd5] via-[#86a8e7] to-[#91eac9] flex flex-col items-center">
      {/* Meet Jules Title Section */}
      <section className="w-full flex justify-center items-center pt-6 pb-0">
        <h1 className="text-6xl md:text-7xl font-bold text-black">Meet Jules</h1>
      </section>
      
      {/* Hero Section */}
      <section className="w-full max-w-5xl flex flex-col md:flex-row items-center justify-between py-16 px-6 md:px-12">
        <div className="flex-1 flex flex-col items-center md:items-start justify-center mb-10 md:mb-0">
          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-10 leading-tight drop-shadow-lg text-center md:text-left">Your Utimate Wingman</h2>
          <h4 className="text-xl md:text-2xl font-semibold text-white mb-8 leading-tight drop-shadow text-center md:text-left">Most guys want to show up confident, but aren&apos;t sure how.</h4>
          <p className="text-lg md:text-xl text-white mb-8 leading-tight drop-shadow text-center md:text-left">Jules helps you refine your style, your words, and your presence - without the guesswork.</p>
          <div className="flex gap-4 justify-center md:justify-start">
            <Link href="/login">
              <button className="bg-pink-500 hover:bg-pink-600 text-white font-semibold px-6 py-3 rounded-lg shadow transition-all text-lg w-48 h-16">
                Try Jules Now
              </button>
            </Link>
            <button className="bg-gray-200 text-gray-500 font-semibold px-6 py-3 rounded-lg shadow text-lg cursor-not-allowed w-48 h-16 flex items-center justify-center leading-tight" disabled>
              <span>App download<br />coming soon</span>
            </button>
          </div>
          <p className="text-sm text-white/80 mt-3 drop-shadow text-center md:text-left">Free to start. Instant feedback. Built to make you better.</p>
        </div>
        <div className="flex-1 flex justify-center">
          <Image
            src="/jules-mvp.png"
            alt="Jules avatar"
            width={320}
            height={320}
            className="rounded-2xl shadow-xl border-4 border-white"
            priority
          />
        </div>
      </section>

      {/* How Jules Helps */}
      <section className="w-full bg-white py-12 px-6 md:px-12 flex flex-col items-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-10 text-gray-900 text-center">How Jules Helps</h2>
        <div className="flex flex-col md:flex-row gap-10 md:gap-20 justify-center mb-8 w-full max-w-4xl">
          <div className="flex-1 flex flex-col items-center text-center">
            <span className="text-4xl mb-2">👕</span>
            <h3 className="text-xl font-semibold mb-2 text-black">Style</h3>
            <p className="text-gray-700">Find your fit. Dress with confidence. No more <span className="font-semibold">second-guessing</span>. Jules helps you refine your look without losing your edge&apos;always on point.</p>
          </div>
          <div className="flex-1 flex flex-col items-center text-center">
            <span className="text-4xl mb-2">💬</span>
            <h3 className="text-xl font-semibold mb-2 text-black">Dating</h3>
            <p className="text-gray-700">Texts, icebreakers, and moves that actually work. Jules helps you play your <span className="font-semibold">cards right</span>—with timing, tone, and confidence that doesn&apos;t feel forced.</p>
          </div>
          <div className="flex-1 flex flex-col items-center text-center">
            <span className="text-4xl mb-2">🧠</span>
            <h3 className="text-xl font-semibold mb-2 text-black">Mindset</h3>
            <p className="text-gray-700">Walk in like you own the room—without faking it. Jules gives you the cues and context to stay <span className="font-semibold">grounded</span> and lead with <span className="font-semibold">presence</span>.</p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="w-full bg-white py-12 px-6 md:px-12 flex flex-col items-center border-t">
        <h2 className="text-2xl md:text-3xl font-bold mb-8 text-gray-900 text-center">How It Works</h2>
        <div className="flex flex-col md:flex-row items-center gap-10 w-full max-w-4xl">
          <ol className="flex-1 list-decimal list-inside text-lg text-gray-800 space-y-4 mb-8 md:mb-0">
            <li>Tell Jules about yourself.</li>
            <li>Ask anything—from what to wear to what to text.</li>
            <li>Get real advice instantly. No fluff, no cringe.</li>
          </ol>
          <div className="flex-1 flex flex-col items-center">
            <video
              src="/Jules-intro-video.mp4"
              width={260}
              height={260}
              controls
              className="rounded-2xl shadow-lg border-2 border-gray-200 mb-4 object-cover"
              style={{ maxWidth: 260, maxHeight: 260 }}
            />
          </div>
        </div>
        <div className="mt-10">
          <Link href="/login">
            <button className="bg-pink-500 hover:bg-pink-600 text-white font-semibold px-6 py-3 rounded-lg shadow transition-all text-lg">
              Try Jules Free
            </button>
          </Link>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="w-full bg-white py-12 px-6 md:px-12 flex flex-col items-center border-t">
        <h2 className="text-3xl md:text-4xl font-bold mb-10 text-gray-900 text-center">FAQs</h2>
        <FAQAccordion />
      </section>

      {/* Footer */}
      <footer className="w-full py-6 bg-gradient-to-t from-[#7f7fd5]/30 to-white/0 flex flex-col items-center mt-auto">
        <div className="flex gap-6 text-gray-600 text-sm">
          <Link href="/privacy-policy" className="hover:underline">Privacy Policy</Link>
          <span>|</span>
          <Link href="/terms-of-service" className="hover:underline">Terms of Service</Link>
        </div>
        <div className="mt-2 text-xs text-gray-400">&copy; {new Date().getFullYear()} Jules Labs. All rights reserved.</div>
      </footer>
    </div>
  );
}

// FAQAccordion component
function FAQAccordion() {
  const faqs = [
    {
      question: "Why Jules? Why Now?",
      answer:
        "We were tired of the lack of trusted resources that help men get their style, fitness, and social life together. From red-pill influencer communities to inconsistent online forumns to AI girlfriends. Men deserve more and deserve better. We all want to show up the best we can, which is why we created Jules. Jules gets to know you and your preferences and helps you navigate the real world. She&apos;ll help you deal with hard problems in a graceful way, and she&apos;ll help you show up the way you want to show up. Masculinity is a personal thing...Jules helps you define what it means for you.",
    },
    {
      question: "Is Jules just AI?",
      answer:
        "Yes. Jules is an AI companion, but not the boring kind, or an AI girlfriend. She's powered by AI, but acts more like your friend than a chatbot.",
    },
    {
      question: "Can Jules help with anything?",
      answer:
        "Jules is about style and outfits, dating, confidence, and how you show up. She won't write your resume, but will tell you if your jacket&apos;s wrong. We&apos;re working on training Jules with clinical data so she can better help you navigate any of life&apos;s situations. For now, she&apos;s an AI friend that can help you show up better in the real world.",
    },
    {
      question: "Is this for guys only?",
      answer: "Jules was designed with men in mind.",
    },
    {
      question: "How personal does this get?",
      answer:
        "You control what you share. Jules doesn't remember anything unless you use the advanced version, coming later.",
    },
    {
      question: "Is it free?",
      answer: "Yes, Jules is free to try. Just click the button and talk to her.",
    },
    {
      question: "What do you do with my data?",
      answer:
        "Your data is secure. We don't harvest data, save it, or sell it.",
    },
  ];
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="w-full max-w-3xl flex flex-col gap-6">
      {faqs.map((faq, idx) => (
        <div
          key={faq.question}
          className="bg-gray-100 rounded-xl p-6 shadow-sm"
        >
          <button
            className="flex items-center w-full text-left focus:outline-none"
            onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
            aria-expanded={openIndex === idx}
            aria-controls={`faq-panel-${idx}`}
          >
            <span className="text-2xl mr-3 text-gray-400 select-none">
              {openIndex === idx ? "–" : "+"}
            </span>
            <span className="font-bold text-lg md:text-xl text-gray-900">
              {faq.question}
            </span>
          </button>
          {openIndex === idx && (
            <div
              id={`faq-panel-${idx}`}
              className="mt-3 text-gray-700 text-base md:text-lg animate-fade-in"
            >
              {faq.answer}
            </div>
          )}
        </div>
      ))}
      <div className="flex justify-center mt-8">
        <Link href="/login">
          <button className="bg-pink-500 hover:bg-pink-600 text-white font-semibold px-6 py-3 rounded-lg shadow transition-all text-lg">
            Try Jules Now
          </button>
        </Link>
      </div>
      <div className="mt-6 text-center text-xs text-gray-500 italic">
        Disclaimer** Jules is an AI tool. It does not provide medical, legal, or professional advice
      </div>
    </div>
  );
}
