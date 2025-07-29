'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { onboarding } from '@/lib/api';

interface UserProfile {
  userId: string;
  name: string;
  toneLevel: number;
  preferences: Record<string, any>;
  settings: {
    julesPersonality: number;
    aboutMe: string;
  };
  bodyInfo: {
    height: string;
    weight: string;
    topSize: string;
    bottomSize: string;
  };
}

const jobStatusOptions = ['Corporate', 'Freelance', 'Student', 'WFH', 'Other'];
const relationshipStatusOptions = ['Single', 'Dating', 'Married', 'Divorced'];
const topSizeOptions = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const bottomSizeOptions = ['28', '29', '30', '31', '32', '33', '34', '35', '36', '38', '40', '42'];

export default function Settings() {
  const [profile, setProfile] = useState<UserProfile | null>(null); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toneLevel, setToneLevel] = useState(2);
  const [name, setName] = useState('');
  const [julesPersonality, setJulesPersonality] = useState(2); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [aboutMe, setAboutMe] = useState('');
  const [brands, setBrands] = useState('');
  const [hobbies, setHobbies] = useState('');
  const [jobStatus, setJobStatus] = useState('');
  const [relationshipStatus, setRelationshipStatus] = useState('');
  const [location, setLocation] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [topSize, setTopSize] = useState('');
  const [bottomSize, setBottomSize] = useState('');

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
      console.log('Loading profile for userId:', userId);
      if (!userId) {
        console.log('No userId found');
        setLoading(false);
        return;
      }

      const data = await onboarding.getOnboardingStatus(userId);
      console.log('Profile data received:', data);
      setProfile(data.user);
      setToneLevel(data.user.settings?.julesPersonality || 2);
      setName(data.user.name || '');
      setJulesPersonality(data.user.settings?.julesPersonality || 2);
      setAboutMe(data.user.settings?.aboutMe || '');
      setBrands(data.user.preferences?.brands || '');
      setHobbies(data.user.preferences?.hobbies || '');
      setJobStatus(data.user.preferences?.jobStatus || '');
      setRelationshipStatus(data.user.preferences?.relationshipStatus || '');
      setLocation(data.user.preferences?.location || '');
      setHeight(data.user.bodyInfo?.height || '');
      setWeight(data.user.bodyInfo?.weight || '');
      setTopSize(data.user.bodyInfo?.topSize || '');
      setBottomSize(data.user.bodyInfo?.bottomSize || '');
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      const userId = getUserIdFromToken();
      if (!userId) {
        console.error('No userId found');
        return;
      }

      console.log('Saving settings for userId:', userId);
      console.log('Settings data:', { name, toneLevel, aboutMe, brands, hobbies, jobStatus, relationshipStatus, location, height, weight, topSize, bottomSize });

      const onboardingData = {
        name,
        settings: {
          julesPersonality: toneLevel, // Use toneLevel instead of julesPersonality
          aboutMe
        },
        preferences: {
          brands,
          hobbies,
          jobStatus,
          relationshipStatus,
          location,
          toneLevel // Also save toneLevel in preferences
        },
        bodyInfo: {
          height,
          weight,
          topSize,
          bottomSize
        }
      };

      console.log('Calling onboarding.completeOnboarding with:', onboardingData);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 10000); // 10 second timeout
      });
      
      const data = await Promise.race([
        onboarding.completeOnboarding(userId, onboardingData),
        timeoutPromise
      ]);
      
      console.log('Settings saved successfully:', data);
      setProfile(data.user);
      
      // Show success feedback
      const saveButton = document.getElementById('save-button');
      if (saveButton) {
        saveButton.textContent = 'Saved!';
        saveButton.className = 'px-4 py-2 bg-green-500 text-white rounded-lg font-medium transition-colors';
        setTimeout(() => {
          saveButton.textContent = 'Save Settings';
          saveButton.className = 'px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors';
        }, 2000);
      } else {
        console.log('Save button not found for success feedback');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      // Show error feedback
      const saveButton = document.getElementById('save-button');
      if (saveButton) {
        saveButton.textContent = 'Error!';
        saveButton.className = 'px-4 py-2 bg-red-500 text-white rounded-lg font-medium transition-colors';
        setTimeout(() => {
          saveButton.textContent = 'Save Settings';
          saveButton.className = 'px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors';
        }, 2000);
      }
    } finally {
      setSaving(false);
      console.log('Save operation completed, setSaving(false) called');
    }
  };

  function getUserIdFromToken() {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem('token');
    console.log('Token from localStorage:', token ? 'exists' : 'not found');
    if (!token) return null;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      console.log('Token payload:', payload);
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

          {/* Personal Information */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">About Me</label>
                <textarea
                  value={aboutMe}
                  onChange={(e) => setAboutMe(e.target.value)}
                  rows={3}
                  placeholder="Tell Jules a little about yourself..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900"
                />
              </div>
            </div>
          </div>

          {/* Style Preferences */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Style Preferences</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Brands you like</label>
                <input
                  type="text"
                  value={brands}
                  onChange={(e) => setBrands(e.target.value)}
                  placeholder="e.g., Nike, Buck Mason"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">What you do for fun</label>
                <input
                  type="text"
                  value={hobbies}
                  onChange={(e) => setHobbies(e.target.value)}
                  placeholder="e.g., golf, weekend hikes"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Job situation</label>
                <select
                  value={jobStatus}
                  onChange={(e) => setJobStatus(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                >
                  <option value="">Select job status</option>
                  {jobStatusOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Relationship status</label>
                <select
                  value={relationshipStatus}
                  onChange={(e) => setRelationshipStatus(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                >
                  <option value="">Select relationship status</option>
                  {relationshipStatusOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Portland, OR"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
              </div>
            </div>
          </div>

          {/* Body Information */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Body Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Height</label>
                <input
                  type="text"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="e.g., 5'10&quot;"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Weight</label>
                <input
                  type="text"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="e.g., 170 lbs"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Typical top size</label>
                <select
                  value={topSize}
                  onChange={(e) => setTopSize(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                >
                  <option value="">Select top size</option>
                  {topSizeOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Typical bottom size</label>
                <select
                  value={bottomSize}
                  onChange={(e) => setBottomSize(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                >
                  <option value="">Select bottom size</option>
                  {bottomSizeOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-6">
            <button
              id="save-button"
              onClick={saveSettings}
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