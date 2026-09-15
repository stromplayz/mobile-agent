package expo.modules.terminalruntime

import android.content.Context
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.concurrent.TimeUnit
import java.util.zip.ZipInputStream

class BootstrapInstaller(private val context: Context) {
  val rootDir: File by lazy { File(context.filesDir, "terminal-bootstrap").apply { mkdirs() } }
  val bootstrapRoot: File get() = rootDir
  val markerFile: File get() = File(rootDir, ".bootstrap-ready")

  fun isReady(): Boolean = markerFile.exists() && File(rootDir, "usr/bin/sh").exists()

  private fun bootstrapUrlForAbi(): String? {
    val abis = if (android.os.Build.VERSION.SDK_INT >= 21) android.os.Build.SUPPORTED_ABIS.toList()
    else listOf(android.os.Build.CPU_ABI).filterNotNull()
    val arch = when {
      abis.any { it.equals("arm64-v8a", true) } -> "aarch64"
      abis.any { it.startsWith("armeabi", true) } -> "arm"
      abis.any { it.equals("x86_64", true) } -> "x86_64"
      else -> null
    } ?: return null
    return "https://github.com/termux/termux-packages/releases/download/bootstrap-$arch/bootstrap-$arch.zip"
  }

  fun installIfNeeded(onProgress: ((percent: Int) -> Unit)? = null): BootstrapResult {
    if (isReady()) return BootstrapResult.Success(rootDir.absolutePath, "already installed")
    val url = bootstrapUrlForAbi() ?: return BootstrapResult.Unsupported
    val zipFile = File(rootDir, "bootstrap.zip").apply { parentFile?.mkdirs() }
    try {
      if (!zipFile.exists()) downloadZip(url, zipFile, onProgress)
      extractZip(zipFile, rootDir)
      File(rootDir, "usr/bin").listFiles()?.forEach { f -> if (f.isFile) try { f.setExecutable(true, true) } catch (_: Exception) {} }
      markerFile.writeText("ready")
      return BootstrapResult.Success(rootDir.absolutePath, "installed")
    } catch (e: Exception) { return BootstrapResult.Failed(e.message ?: "unknown error") }
  }

  private fun downloadZip(url: String, target: File, onProgress: ((Int) -> Unit)?) {
    val client = OkHttpClient.Builder().connectTimeout(30, TimeUnit.SECONDS).readTimeout(120, TimeUnit.SECONDS).build()
    val request = Request.Builder().url(url).get().build()
    client.newCall(request).execute().use { response ->
      if (!response.isSuccessful) throw IOException("HTTP ${response.code}")
      val body = response.body ?: throw IOException("Empty body")
      val total = body.contentLength()
      var written = 0L
      body.byteStream().use { input ->
        FileOutputStream(target).use { output ->
          val buf = ByteArray(16 * 1024)
          while (true) { val n = input.read(buf); if (n < 0) break; output.write(buf, 0, n); written += n; if (total > 0 && onProgress != null) onProgress((written * 100 / total).toInt().coerceIn(0, 100)) }
        }
      }
    }
  }

  private fun extractZip(zipFile: File, dest: File) {
    ZipInputStream(zipFile.inputStream().buffered()).use { zis ->
      var entry = zis.nextEntry; val buf = ByteArray(16 * 1024)
      while (entry != null) {
        val out = File(dest, entry.name)
        if (entry.isDirectory) out.mkdirs()
        else { out.parentFile?.mkdirs(); FileOutputStream(out).use { fos -> while (true) { val n = zis.read(buf); if (n < 0) break; fos.write(buf, 0, n) } } }
        entry = zis.nextEntry
      }
    }
  }
}

sealed class BootstrapResult {
  data class Success(val root: String, val message: String) : BootstrapResult()
  object Unsupported : BootstrapResult()
  data class Failed(val error: String) : BootstrapResult()
}
