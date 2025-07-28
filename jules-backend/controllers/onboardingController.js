const User = require('../models/User');

exports.completeOnboarding = async (req, res) => {
  try {
    const { userId, onboardingData } = req.body;
    
    if (!userId || !onboardingData) {
      return res.status(400).json({ error: 'User ID and onboarding data are required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user with onboarding data
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        name: onboardingData.name,
        isOnboarded: true,
        settings: {
          julesPersonality: onboardingData.settings?.julesPersonality || 2,
          aboutMe: onboardingData.settings?.aboutMe || ''
        },
        preferences: {
          ...user.preferences,
          brands: onboardingData.preferences?.brands || '',
          hobbies: onboardingData.preferences?.hobbies || '',
          jobStatus: onboardingData.preferences?.jobStatus || '',
          relationshipStatus: onboardingData.preferences?.relationshipStatus || '',
          location: onboardingData.preferences?.location || ''
        },
        bodyInfo: {
          height: onboardingData.bodyInfo?.height || '',
          weight: onboardingData.bodyInfo?.weight || '',
          topSize: onboardingData.bodyInfo?.topSize || '',
          bottomSize: onboardingData.bodyInfo?.bottomSize || ''
        }
      },
      { new: true }
    );

    res.status(200).json({ 
      success: true, 
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        isOnboarded: updatedUser.isOnboarded,
        settings: updatedUser.settings,
        preferences: updatedUser.preferences,
        bodyInfo: updatedUser.bodyInfo
      }
    });
  } catch (error) {
    console.error('Error completing onboarding:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

exports.getOnboardingStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ 
      isOnboarded: user.isOnboarded,
      user: {
        id: user._id,
        name: user.name,
        settings: user.settings,
        preferences: user.preferences,
        bodyInfo: user.bodyInfo
      }
    });
  } catch (error) {
    console.error('Error getting onboarding status:', error);
    res.status(500).json({ error: 'Server Error' });
  }
}; 