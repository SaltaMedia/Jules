'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface UserProfile {
  userId: string;
  toneLevel: number;
  preferences: any;
}

export default function Settings() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toneLevel, setToneLevel] = useState(2);

  const toneDescriptions = {
    1: "Gentle & Supportive - Jules will be more empathetic and nurturing",
    2: "Balanced - Jules will be direct but caring (default)",
    3: "Confident & Bold - Jules will be more assertive and challenging"
  };

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const userId = getUserIdFromToken();
      if (!userId) {
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/user-profile/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setToneLevel(data.toneLevel || 2);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveToneLevel = async () => {
    try {
      setSaving(true);
      const userId = getUserIdFromToken();
      if (!userId) return;

      const response = await fetch(`/api/user-profile/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ toneLevel }),
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
        // Show success feedback
        const saveButton = document.getElementById('save-button');
        if (saveButton) {
          const originalText = saveButton.textContent;
          saveButton.textContent = 'Saved!';
          saveButton.className = 'px-4 py-2 bg-green-500 text-white rounded-lg font-medium transition-colors';
          setTimeout(() => {
            saveButton.textContent = originalText;
            saveButton.className = 'px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors';
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Error saving tone level:', error);
    } finally {
      setSaving(false);
    }
  };

  function getUserIdFromToken() {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem('authToken');
    if (!token) return null;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId;
    } catch (error) {
      console.error('Error parsing token:', error);
      return null;
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-white to-gray-200">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-white to-gray-200 pb-safe">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/chat" className="text-gray-500 hover:text-gray-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-semibold">
            J
          </div>
          <h1 className="font-semibold text-lg text-gray-900">Settings</h1>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Jules Tone Settings</h2>
            <p className="text-gray-600 mb-6">
              Adjust how Jules communicates with you. This affects her personality and response style.
            </p>
          </div>

          {/* Tone Level Slider */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Tone Level</label>
              <span className="text-sm text-gray-500">{toneLevel}/3</span>
            </div>
            
            <div className="relative">
              <input
                type="range"
                min="1"
                max="3"
                value={toneLevel}
                onChange={(e) => setToneLevel(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(toneLevel - 1) * 50}%, #e5e7eb ${(toneLevel - 1) * 50}%, #e5e7eb 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>Gentle</span>
                <span>Balanced</span>
                <span>Bold</span>
              </div>
            </div>

            {/* Tone Description */}
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                {toneDescriptions[toneLevel as keyof typeof toneDescriptions]}
              </p>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              id="save-button"
              onClick={saveToneLevel}
              disabled={saving}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          {/* Info Section */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">How Tone Affects Jules</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <strong>Gentle (Level 1):</strong> More empathetic, supportive responses. Great when you're feeling down or need encouragement.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <strong>Balanced (Level 2):</strong> Direct but caring. Jules' default personality - honest advice with warmth.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <strong>Bold (Level 3):</strong> More assertive and challenging. Pushes you to grow and take action.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
} 