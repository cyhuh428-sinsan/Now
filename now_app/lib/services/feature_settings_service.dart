import 'package:shared_preferences/shared_preferences.dart';

class FeatureSettings {
  final bool speakerSeparationEnabled;
  final bool voiceEmotionEnabled;

  const FeatureSettings({
    required this.speakerSeparationEnabled,
    required this.voiceEmotionEnabled,
  });

  static const defaults = FeatureSettings(
    speakerSeparationEnabled: false,
    voiceEmotionEnabled: false,
  );
}

class FeatureSettingsService {
  static const speakerSeparationKey = 'feature_speaker_separation_enabled';
  static const voiceEmotionKey = 'feature_voice_emotion_enabled';

  static Future<FeatureSettings> load() async {
    final prefs = await SharedPreferences.getInstance();
    return FeatureSettings(
      speakerSeparationEnabled: prefs.getBool(speakerSeparationKey) ??
          FeatureSettings.defaults.speakerSeparationEnabled,
      voiceEmotionEnabled:
          prefs.getBool(voiceEmotionKey) ?? FeatureSettings.defaults.voiceEmotionEnabled,
    );
  }

  static Future<void> saveSpeakerSeparation(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(speakerSeparationKey, value);
  }

  static Future<void> saveVoiceEmotion(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(voiceEmotionKey, value);
  }
}
