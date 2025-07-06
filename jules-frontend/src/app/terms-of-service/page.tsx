"use client";

export default function TermsOfService() {
  return (
    <main className="max-w-2xl mx-auto py-16 px-4">
      <h1 className="text-4xl font-bold mb-6">Terms of Service</h1>
      <p className="mb-4">Effective Date: {new Date().getFullYear()}</p>
      <h2 className="text-2xl font-semibold mt-8 mb-2">Acceptance of Terms</h2>
      <p className="mb-4">By using Jules Labs, you agree to these Terms of Service. If you do not agree, please do not use our services.</p>
      <h2 className="text-2xl font-semibold mt-8 mb-2">Use of Service</h2>
      <ul className="list-disc list-inside mb-4">
        <li>You must be at least 13 years old to use Jules Labs.</li>
        <li>Do not use our service for unlawful or harmful purposes.</li>
        <li>We may suspend or terminate your access if you violate these terms.</li>
      </ul>
      <h2 className="text-2xl font-semibold mt-8 mb-2">Intellectual Property</h2>
      <p className="mb-4">All content, trademarks, and data on this site are the property of Jules Labs or its licensors. You may not copy, modify, or distribute our content without permission.</p>
      <h2 className="text-2xl font-semibold mt-8 mb-2">Disclaimer</h2>
      <p className="mb-4">Jules Labs is provided &quot;as is&quot; without warranties of any kind. We do not provide medical, legal, or professional advice. Use at your own risk.</p>
      <h2 className="text-2xl font-semibold mt-8 mb-2">Limitation of Liability</h2>
      <p className="mb-4">Jules Labs is not liable for any damages or losses resulting from your use of our service.</p>
      <h2 className="text-2xl font-semibold mt-8 mb-2">Changes to Terms</h2>
      <p className="mb-4">We may update these Terms of Service at any time. Continued use of the service means you accept the new terms.</p>
      <h2 className="text-2xl font-semibold mt-8 mb-2">Contact Us</h2>
      <p>If you have any questions about these Terms, please contact us at support@juleslabs.com.</p>
    </main>
  );
} 