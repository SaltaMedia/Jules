'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import { onboarding } from '@/lib/api';

interface OnboardingData {
  name: string;
  settings: {
    julesPersonality: number;
    aboutMe: string;
  };
  preferences: {
    brands: string;
    hobbies: string;
    jobStatus: string;
    relationshipStatus: string;
    location: string;
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

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    name: '',
    settings: {
      julesPersonality: 2,
      aboutMe: ''
    },
    preferences: {
      brands: '',
      hobbies: '',
      jobStatus: '',
      relationshipStatus: '',
      location: ''
    },
    bodyInfo: {
      height: '',
      weight: '',
      topSize: '',
      bottomSize: ''
    }
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const decoded: any = jwtDecode(token);
      setUserId(decoded.userId);
    } catch (error) {
      console.error('Error decoding token:', error);
      router.push('/login');
    }
  }, [router]);

  const updateOnboardingData = (field: string, value: any) => {
    setOnboardingData(prev => {
      const newData = { ...prev };
      const keys = field.split('.');
      let current: any = newData;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      
      return newData;
    });
  };

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleComplete = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      await onboarding.completeOnboarding(userId, onboardingData);
      router.push('/chat');
    } catch (error) {
      console.error('Error completing onboarding:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-white to-gray-200">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-white to-gray-200 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Jules</h1>
          <p className="text-sm text-gray-500">Step {currentStep} of 5</p>
        </div>

        {/* Step Content */}
        <div className="mb-8">
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">What's your name?</h2>
                <p className="text-gray-600">Let's start with the basics</p>
              </div>
              <input
                type="text"
                value={onboardingData.name}
                onChange={(e) => updateOnboardingData('name', e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">How would you like Jules to interact with you?</h2>
                <p className="text-gray-600">Choose Jules' personality style</p>
              </div>
              <div className="space-y-4">
                {[
                  { value: 1, label: 'Calm', description: 'Gentle and supportive' },
                  { value: 2, label: 'Standard Jules', description: 'Direct but caring (default)' },
                  { value: 3, label: 'Eccentric', description: 'Bold and challenging' }
                ].map((option) => (
                  <label key={option.value} className="flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="julesPersonality"
                      value={option.value}
                      checked={onboardingData.settings.julesPersonality === option.value}
                      onChange={(e) => updateOnboardingData('settings.julesPersonality', parseInt(e.target.value))}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900">{option.label}</div>
                      <div className="text-sm text-gray-600">{option.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Tell Jules a little about you</h2>
                <p className="text-gray-600">This helps Jules understand your context better</p>
              </div>
              <textarea
                value={onboardingData.settings.aboutMe}
                onChange={(e) => updateOnboardingData('settings.aboutMe', e.target.value)}
                placeholder="Share a bit about yourself, your interests, or what brings you here..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900"
              />
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Style Preferences</h2>
                <p className="text-gray-600">Help Jules understand your style better</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Brands you like</label>
                  <input
                    type="text"
                    value={onboardingData.preferences.brands}
                    onChange={(e) => updateOnboardingData('preferences.brands', e.target.value)}
                    placeholder="e.g., Nike, Buck Mason"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">What you do for fun</label>
                  <input
                    type="text"
                    value={onboardingData.preferences.hobbies}
                    onChange={(e) => updateOnboardingData('preferences.hobbies', e.target.value)}
                    placeholder="e.g., golf, weekend hikes"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Job situation</label>
                  <select
                    value={onboardingData.preferences.jobStatus}
                    onChange={(e) => updateOnboardingData('preferences.jobStatus', e.target.value)}
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
                    value={onboardingData.preferences.relationshipStatus}
                    onChange={(e) => updateOnboardingData('preferences.relationshipStatus', e.target.value)}
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
                    value={onboardingData.preferences.location}
                    onChange={(e) => updateOnboardingData('preferences.location', e.target.value)}
                    placeholder="e.g., Portland, OR"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Body Info</h2>
                <p className="text-gray-600">This helps with sizing recommendations</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Height</label>
                  <input
                    type="text"
                    value={onboardingData.bodyInfo.height}
                    onChange={(e) => updateOnboardingData('bodyInfo.height', e.target.value)}
                    placeholder="e.g., 5'10&quot;"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Weight</label>
                  <input
                    type="text"
                    value={onboardingData.bodyInfo.weight}
                    onChange={(e) => updateOnboardingData('bodyInfo.weight', e.target.value)}
                    placeholder="e.g., 170 lbs"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Typical top size</label>
                  <select
                    value={onboardingData.bodyInfo.topSize}
                    onChange={(e) => updateOnboardingData('bodyInfo.topSize', e.target.value)}
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
                    value={onboardingData.bodyInfo.bottomSize}
                    onChange={(e) => updateOnboardingData('bodyInfo.bottomSize', e.target.value)}
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
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          {currentStep > 1 && (
            <button
              onClick={handlePrevious}
              className="text-gray-600 hover:text-gray-800 font-medium"
            >
              Back
            </button>
          )}
          
          <div className="flex gap-3 ml-auto">
            {currentStep < 5 && (
              <button
                onClick={handleSkip}
                className="text-gray-600 hover:text-gray-800 font-medium"
              >
                Skip
              </button>
            )}
            
            {currentStep < 5 ? (
              <button
                onClick={handleNext}
                disabled={currentStep === 1 && !onboardingData.name.trim()}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={loading}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Save & Continue'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 