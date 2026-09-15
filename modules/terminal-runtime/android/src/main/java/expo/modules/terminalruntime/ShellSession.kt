package expo.modules.terminalruntime

import android.content.Context
import java.io.BufferedReader
import java.io.File
import java.io.IOException
import java.io.InputStreamReader
import java.io.OutputStream
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

class ShellSession(
  val id: String,
  val name: String,
  private val process: Process,
  private val output: OutputStream,
  private val onOutput: (data: String) -> Unit,
  private val onExit: (exitCode: Int) -> Unit,
  private val onError: (message: String) -> Unit,
) {
  private val executor = Executors.newCachedThreadPool { r ->
    Thread(r, "terminal-session-$id").apply { isDaemon = true }
  }
  @Volatile private var closed: Boolean = false

  init {
    executor.submit {
      try {
        BufferedReader(InputStreamReader(process.inputStream, Charsets.UTF_8)).use { reader ->
          val buffer = CharArray(2048)
          while (true) {
            val read = reader.read(buffer)
            if (read < 0) break
            if (read > 0) onOutput(String(buffer, 0, read))
          }
        }
      } catch (e: IOException) { if (!closed) onError("stdout: ${e.message}") }
    }
    executor.submit {
      try {
        BufferedReader(InputStreamReader(process.errorStream, Charsets.UTF_8)).use { reader ->
          val buffer = CharArray(2048)
          while (true) {
            val read = reader.read(buffer)
            if (read < 0) break
            if (read > 0) onOutput(String(buffer, 0, read))
          }
        }
      } catch (_: IOException) {}
    }
    executor.submit { val code = process.waitFor(); onExit(code) }
  }

  fun write(data: String) {
    try {
      output.write(data.toByteArray(Charsets.UTF_8))
      output.flush()
    } catch (e: IOException) { if (!closed) onError("stdin: ${e.message}") }
  }

  fun close() {
    if (closed) return
    closed = true
    try { output.close() } catch (_: IOException) {}
    try { process.destroyForcibly() } catch (_: Exception) {}
    executor.shutdownNow()
  }
  fun isAlive(): Boolean = process.isAlive
}

class ShellSessionRegistry {
  private val sessions = ConcurrentHashMap<String, ShellSession>()
  fun put(session: ShellSession) { sessions[session.id] = session }
  fun get(id: String): ShellSession? = sessions[id]
  fun remove(id: String): ShellSession? = sessions.remove(id)
  fun list(): List<ShellSession> = sessions.values.toList()
  fun closeAll() { sessions.values.forEach { it.close() }; sessions.clear() }
}

fun buildShellProcess(
  context: Context,
  cwd: String,
  shell: String?,
  bootstrapRoot: File?,
  env: Map<String, String> = emptyMap(),
): Pair<Process, OutputStream> {
  val candidates = mutableListOf<List<String>>()
  if (bootstrapRoot != null) {
    val bash = File(bootstrapRoot, "usr/bin/bash")
    if (bash.canExecute()) candidates.add(listOf(bash.absolutePath, "-i"))
  }
  val termuxBash = File("/data/data/com.termux/files/usr/bin/bash")
  if (termuxBash.canExecute()) candidates.add(listOf(termuxBash.absolutePath, "-i"))
  if (!shell.isNullOrBlank() && File(shell).canExecute()) candidates.add(listOf(shell, "-i"))
  candidates.add(listOf("/system/bin/sh"))

  val argv = candidates.first()
  val pb = ProcessBuilder(argv).directory(File(cwd)).redirectErrorStream(false)
  val environment = pb.environment()
  if (bootstrapRoot != null) {
    val binDir = File(bootstrapRoot, "usr/bin").absolutePath
    val existingPath = environment["PATH"] ?: ""
    environment["PATH"] = "$binDir:$existingPath"
    environment["HOME"] = bootstrapRoot.absolutePath
    environment["TERM"] = "xterm-256color"
    environment["LANG"] = "en_US.UTF-8"
    environment["PREFIX"] = File(bootstrapRoot, "usr").absolutePath
  }
  for ((k, v) in env) environment[k] = v
  val tmpDir = File(context.cacheDir, "terminal-tmp").apply { mkdirs() }
  environment["TMPDIR"] = tmpDir.absolutePath
  val process = pb.start()
  return process to process.outputStream
}

fun execOnce(cwd: String, command: String, timeoutMs: Long = 30_000L, env: Map<String, String> = emptyMap()): Triple<Int, String, String> {
  val pb = ProcessBuilder("/system/bin/sh", "-c", command).directory(File(cwd)).redirectErrorStream(false)
  val environment = pb.environment()
  for ((k, v) in env) environment[k] = v
  val process = pb.start()
  val stdout = StringBuilder()
  val stderr = StringBuilder()
  val executor = Executors.newFixedThreadPool(2) { r -> Thread(r, "exec-once-${System.nanoTime()}").apply { isDaemon = true } }
  val outFuture = executor.submit {
    BufferedReader(InputStreamReader(process.inputStream, Charsets.UTF_8)).use { r ->
      val buf = CharArray(2048); while (true) { val n = r.read(buf); if (n < 0) break; stdout.append(buf, 0, n) }
    }
  }
  val errFuture = executor.submit {
    BufferedReader(InputStreamReader(process.errorStream, Charsets.UTF_8)).use { r ->
      val buf = CharArray(2048); while (true) { val n = r.read(buf); if (n < 0) break; stderr.append(buf, 0, n) }
    }
  }
  try {
    val finished = process.waitFor(timeoutMs, TimeUnit.MILLISECONDS)
    if (!finished) { process.destroyForcibly(); outFuture.cancel(true); errFuture.cancel(true); throw TimeoutException("timed out") }
  } catch (e: InterruptedException) { process.destroyForcibly(); Thread.currentThread().interrupt() }
  finally { outFuture.get(); errFuture.get(); executor.shutdownNow() }
  val code = try { process.exitValue() } catch (_: Exception) { -1 }
  return Triple(code, stdout.toString(), stderr.toString())
}
