"use client";

export default function PrivacyPolicy() {
  return (
    <main className="max-w-2xl mx-auto py-16 px-4">
      <h1 className="text-4xl font-bold mb-6">Privacy Policy</h1>
      <p className="mb-4">Effective Date: {new Date().getFullYear()}</p>
      <p className="mb-4">Jules Labs (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our website and services.</p>
      <h2 className="text-2xl font-semibold mt-8 mb-2">Information We Collect</h2>
      <ul className="list-disc list-inside mb-4">
        <li>Personal information you provide (such as email, name, etc.)</li>
        <li>Usage data (such as pages visited, features used, etc.)</li>
        <li>Device and browser information</li>
      </ul>
      <h2 className="text-2xl font-semibold mt-8 mb-2">How We Use Your Information</h2>
      <ul className="list-disc list-inside mb-4">
        <li>To provide and improve our services</li>
        <li>To communicate with you about updates or support</li>
        <li>To ensure security and prevent abuse</li>
      </ul>
      <h2 className="text-2xl font-semibold mt-8 mb-2">Data Security</h2>
      <p className="mb-4">We use industry-standard measures to protect your data. We do not sell, rent, or share your personal information with third parties except as required by law or to provide our services.</p>
      <h2 className="text-2xl font-semibold mt-8 mb-2">Your Choices</h2>
      <p className="mb-4">You may request to access, update, or delete your personal information by contacting us at support@juleslabs.com.</p>
      <h2 className="text-2xl font-semibold mt-8 mb-2">Changes to This Policy</h2>
      <p className="mb-4">We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the new policy on this page.</p>
      <h2 className="text-2xl font-semibold mt-8 mb-2">Contact Us</h2>
      <p>If you have any questions about this Privacy Policy, please contact us at support@juleslabs.com.</p>
    </main>
  );
} 