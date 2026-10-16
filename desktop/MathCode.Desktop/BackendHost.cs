using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Net.Sockets;
using System.Text.Json;
using System.Security.Cryptography;
namespace MathCode.Desktop;
internal sealed class BackendHost : IDisposable
{
 public string Root {get;}
 public string Database {get;}
 public int Port {get;}
 public string Url=>$"http://127.0.0.1:{Port}/";
 private Process? owned;
 private readonly HttpClient http=new(){Timeout=TimeSpan.FromSeconds(2)};
 public BackendHost(string root,string database,int port){Root=root;Database=Path.GetFullPath(database);Port=port;}
 public static string LocateRoot(){var d=new DirectoryInfo(AppContext.BaseDirectory);while(d!=null){if(File.Exists(Path.Combine(d.FullName,"mathcode.project.json")))return d.FullName;d=d.Parent;}throw new DirectoryNotFoundException("找不到数学编程平台目录，请从项目内的启动快捷方式打开。");}
 private string Fingerprint(){using var h=IncrementalHash.CreateHash(HashAlgorithmName.SHA256);foreach(var name in new[]{"start.py","study/storage.py","study/importer.py","study/practice.py"})h.AppendData(File.ReadAllBytes(Path.Combine(Root,name)));return Convert.ToHexString(h.GetHashAndReset()).ToLowerInvariant();}
 public async Task<bool> Healthy(){try{using var j=JsonDocument.Parse(await http.GetStringAsync(Url+"api/health"));var r=j.RootElement;return r.GetProperty("app").GetString()=="math-code-study"&&r.GetProperty("api_version").GetInt32()==1&&string.Equals(r.GetProperty("root").GetString(),Root,StringComparison.OrdinalIgnoreCase)&&string.Equals(r.GetProperty("database").GetString(),Database,StringComparison.OrdinalIgnoreCase)&&r.GetProperty("fingerprint").GetString()==Fingerprint();}catch{return false;}}
 public async Task<bool> Ensure()
 {
  if(await Healthy())return false;
  using(var client=new TcpClient()){try{await client.ConnectAsync("127.0.0.1",Port);throw new InvalidOperationException($"端口 {Port} 已被其他服务占用。请关闭冲突程序或在 runtime.json 设置独立端口。应用没有停止其他程序。");}catch(SocketException){}}
  string python="";
  var config=Path.Combine(Root,"runtime.json");
  if(File.Exists(config)){using var j=JsonDocument.Parse(File.ReadAllText(config));python=j.RootElement.GetProperty("python").GetString()??"";}
  if(!File.Exists(python))throw new FileNotFoundException("找不到配置的Python。请运行 scripts\\configure.ps1 修复本项目运行路径。");
  var info=new ProcessStartInfo(python){WorkingDirectory=Root,UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden};
  foreach(var s in new[]{Path.Combine(Root,"start.py"),"serve","--database",Database,"--port",Port.ToString(),"--idle-timeout","180"})info.ArgumentList.Add(s);
  owned=Process.Start(info)??throw new InvalidOperationException("无法启动本地学习服务。");
  var deadline=DateTime.UtcNow.AddSeconds(30);
  while(DateTime.UtcNow<deadline){await Task.Delay(250);if(await Healthy())return true;if(owned.HasExited)throw new InvalidOperationException("本地服务启动失败。请运行 start.py check 检查数据库。");}
  throw new TimeoutException("本地学习服务30秒内未就绪，请检查本项目数据库和运行配置。");
 }
 public void Dispose(){if(owned!=null){try{if(!owned.HasExited)owned.Kill();}catch{}owned.Dispose();}http.Dispose();}
}
