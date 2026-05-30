package com.sinsan.nownote

import android.util.Base64
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import org.json.JSONObject
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

class MainActivity : FlutterFragmentActivity() {
    private val encryptionChannel = "now_note/encryption"
    private val encryptedPrefix = "NOW_ENCRYPTED_V1:"
    private val encryptionIterations = 210000

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            encryptionChannel,
        ).setMethodCallHandler { call, result ->
            try {
                when (call.method) {
                    "encryptNote" -> {
                        val plainText = call.argument<String>("plainText") ?: ""
                        val password = call.argument<String>("password") ?: ""
                        result.success(encryptNote(plainText, password))
                    }
                    "decryptNote" -> {
                        val content = call.argument<String>("content") ?: ""
                        val password = call.argument<String>("password") ?: ""
                        result.success(decryptNote(content, password))
                    }
                    else -> result.notImplemented()
                }
            } catch (e: Exception) {
                result.error("NOTE_ENCRYPTION_FAILED", e.message, null)
            }
        }
    }

    private fun encryptNote(plainText: String, password: String): String {
        require(password.isNotEmpty()) { "암호 키가 비어 있습니다." }
        val salt = ByteArray(16)
        val iv = ByteArray(12)
        SecureRandom().nextBytes(salt)
        SecureRandom().nextBytes(iv)

        val key = deriveKey(password, salt)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(128, iv))
        val encrypted = cipher.doFinal(plainText.toByteArray(Charsets.UTF_8))

        val payload = JSONObject()
            .put("v", 1)
            .put("alg", "AES-GCM")
            .put("kdf", "PBKDF2-SHA256")
            .put("iterations", encryptionIterations)
            .put("salt", encodeBase64(salt))
            .put("iv", encodeBase64(iv))
            .put("data", encodeBase64(encrypted))

        return encryptedPrefix + encodeBase64(payload.toString().toByteArray(Charsets.UTF_8))
    }

    private fun decryptNote(content: String, password: String): String {
        require(password.isNotEmpty()) { "암호 키가 비어 있습니다." }
        require(content.startsWith(encryptedPrefix)) { "지원하지 않는 암호화 형식입니다." }

        val payloadJson = String(
            Base64.decode(content.removePrefix(encryptedPrefix), Base64.DEFAULT),
            Charsets.UTF_8,
        )
        val payload = JSONObject(payloadJson)
        require(payload.optInt("v") == 1) { "지원하지 않는 암호화 버전입니다." }
        require(payload.optString("alg") == "AES-GCM") { "지원하지 않는 암호화 알고리즘입니다." }
        require(payload.optString("kdf") == "PBKDF2-SHA256") { "지원하지 않는 키 생성 방식입니다." }

        val iterations = payload.optInt("iterations", encryptionIterations)
        val salt = Base64.decode(payload.getString("salt"), Base64.DEFAULT)
        val iv = Base64.decode(payload.getString("iv"), Base64.DEFAULT)
        val encrypted = Base64.decode(payload.getString("data"), Base64.DEFAULT)

        val key = deriveKey(password, salt, iterations)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, iv))
        return String(cipher.doFinal(encrypted), Charsets.UTF_8)
    }

    private fun deriveKey(
        password: String,
        salt: ByteArray,
        iterations: Int = encryptionIterations,
    ): SecretKeySpec {
        val spec = PBEKeySpec(password.toCharArray(), salt, iterations, 256)
        val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        return SecretKeySpec(factory.generateSecret(spec).encoded, "AES")
    }

    private fun encodeBase64(bytes: ByteArray): String {
        return Base64.encodeToString(bytes, Base64.NO_WRAP)
    }
}
