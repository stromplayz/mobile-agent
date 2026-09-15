package expo.modules.terminalruntime

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class TerminalRuntimeModule : Module() {
  private val shellRegistry = ShellSessionRegistry()
  private val bootstrap by lazy { BootstrapInstaller(appContext.reactContext!!) }
  private val sessionCwds = ConcurrentHashMap<String, String>()

  override fun definition() = ModuleDefinition {
    Name("TerminalRuntime")
    Events("onSessionOutput", "onSessionExit", "onSessionError", "onBootstrapProgress")

    AsyncFunction("execOnce") { input: Map<String, Any?> ->
      val cwd = input["cwd"] as? String ?: appContext.reactContext!!.filesDir.absolutePath
      val command = input["command"] as? String ?: throw IllegalArgumentException("command required")
      val timeoutMs = (input["timeoutMs"] as? Number)?.toLong() ?: 30_000L
      @Suppress("UNCHECKED_CAST")
      val env = (input["env"] as? Map<String, String>) ?: emptyMap()
      val (code, stdout, stderr) = execOnce(cwd, command, timeoutMs, env)
      mapOf("exitCode" to code, "stdout" to stdout, "stderr" to stderr)
    }

    AsyncFunction("bootstrapStatus") { mapOf("ready" to bootstrap.isReady(), "root" to bootstrap.rootDir.absolutePath, "supported" to true) }

    AsyncFunction("installBootstrap") {
      val result = bootstrap.installIfNeeded { percent -> sendEvent("onBootstrapProgress", mapOf("percent" to percent)) }
      when (result) {
        is BootstrapResult.Success -> mapOf("ok" to true, "root" to result.root, "message" to result.message)
        BootstrapResult.Unsupported -> mapOf("ok" to false, "error" to "Bootstrap not available for this ABI")
        is BootstrapResult.Failed -> mapOf("ok" to false, "error" to result.error)
      }
    }

    AsyncFunction("createSession") { input: Map<String, Any?> ->
      val name = (input["name"] as? String) ?: "session-${UUID.randomUUID().toString().take(8)}"
      val cwd = (input["cwd"] as? String) ?: appContext.reactContext!!.filesDir.absolutePath
      val shell = input["shell"] as? String
      val useBootstrap = (input["useBootstrap"] as? Boolean) ?: true
      val bootstrapRoot = if (useBootstrap && bootstrap.isReady()) bootstrap.bootstrapRoot else null
      val cwdFile = File(cwd).apply { mkdirs() }
      val (process, stdin) = buildShellProcess(appContext.reactContext!!, cwdFile.absolutePath, shell, bootstrapRoot)
      val id = UUID.randomUUID().toString()
      val session = ShellSession(id, name, process, stdin,
        onOutput = { data -> sendEvent("onSessionOutput", mapOf("sessionId" to id, "data" to data)) },
        onExit = { code -> sendEvent("onSessionExit", mapOf("sessionId" to id, "exitCode" to code)) },
        onError = { msg -> sendEvent("onSessionError", mapOf("sessionId" to id, "message" to msg)) },
      )
      shellRegistry.put(session); sessionCwds[id] = cwdFile.absolutePath
      mapOf("id" to id, "name" to name, "cwd" to cwdFile.absolutePath, "shell" to (shell ?: "auto"), "bootstrapReady" to (bootstrapRoot != null))
    }

    AsyncFunction("sendInput") { input: Map<String, Any?> ->
      val sessionId = input["sessionId"] as? String ?: throw IllegalArgumentException("sessionId required")
      val data = input["data"] as? String ?: ""
      val session = shellRegistry.get(sessionId) ?: return@AsyncFunction mapOf("ok" to false, "error" to "session not found")
      session.write(data); mapOf("ok" to true)
    }

    AsyncFunction("closeSession") { input: Map<String, Any?> ->
      val sessionId = input["sessionId"] as? String ?: throw IllegalArgumentException("sessionId required")
      shellRegistry.remove(sessionId)?.close(); sessionCwds.remove(sessionId); mapOf("ok" to true)
    }

    AsyncFunction("listSessions") {
      shellRegistry.list().map { s -> mapOf("id" to s.id, "name" to s.name, "cwd" to (sessionCwds[s.id] ?: ""), "alive" to s.isAlive()) }
    }

    AsyncFunction("installPackage") { input: Map<String, Any?> ->
      val pkg = input["package"] as? String ?: throw IllegalArgumentException("package required")
      val cwd = (input["cwd"] as? String) ?: appContext.reactContext!!.filesDir.absolutePath
      val cmd = if (bootstrap.isReady()) "export PATH=\$PREFIX/bin:\$PATH; pkg install -y $pkg 2>&1 || apt-get install -y $pkg 2>&1"
        else "echo 'No package manager. Install bootstrap first.' >&2; exit 127"
      val (code, stdout, stderr) = execOnce(cwd, cmd, 120_000L, emptyMap())
      mapOf("exitCode" to code, "stdout" to stdout, "stderr" to stderr)
    }

    OnDestroy { shellRegistry.closeAll() }
  }
}
