package tz.nuru.app

import android.content.ContentValues
import android.os.Environment
import android.provider.MediaStore
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

class MainActivity: FlutterActivity() {
    private val mediaStoreChannel = "tz.nuru.app/media_store"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, mediaStoreChannel)
            .setMethodCallHandler { call, result ->
                if (call.method != "saveToDownloads") {
                    result.notImplemented()
                    return@setMethodCallHandler
                }
                try {
                    val sourcePath = call.argument<String>("sourcePath") ?: ""
                    val fileName = call.argument<String>("fileName") ?: File(sourcePath).name
                    val folderName = call.argument<String>("folderName") ?: "Library"
                    val mimeType = call.argument<String>("mimeType") ?: "application/octet-stream"
                    val source = File(sourcePath)
                    if (!source.exists()) {
                        result.error("missing_source", "Downloaded file was not found", null)
                        return@setMethodCallHandler
                    }

                    val values = ContentValues().apply {
                        put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                        put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
                        put(MediaStore.MediaColumns.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/Nuru/$folderName")
                        put(MediaStore.MediaColumns.IS_PENDING, 1)
                    }
                    val resolver = applicationContext.contentResolver
                    val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                        ?: throw IllegalStateException("Unable to create Downloads entry")
                    resolver.openOutputStream(uri)?.use { out -> source.inputStream().use { it.copyTo(out) } }
                    values.clear()
                    values.put(MediaStore.MediaColumns.IS_PENDING, 0)
                    resolver.update(uri, values, null, null)
                    result.success(uri.toString())
                } catch (e: Exception) {
                    result.error("save_failed", e.message, null)
                }
            }
    }
}
