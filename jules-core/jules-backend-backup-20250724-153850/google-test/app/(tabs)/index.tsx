import * as React from 'react';
import { Button, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();

export default function TabOneScreen() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: '270869386423-rpe63g4mahivpq0cnthlusrr3utrvo4t.apps.googleusercontent.com',
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      alert('Google Login Success! Token: ' + authentication?.accessToken);
    }
  }, [response]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button
        disabled={!request}
        title="Login with Google"
        onPress={() => promptAsync()}
      />
      <Text style={{ marginTop: 20 }}>Test Google Login</Text>
    </View>
  );
} 