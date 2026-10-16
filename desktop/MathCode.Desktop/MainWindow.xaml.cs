using Microsoft.Web.WebView2.Core;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Windows;
using System.Windows.Media.Animation;
using System.Windows.Threading;
namespace MathCode.Desktop;
public partial class MainWindow : Window
{
 private readonly string[] args;
 private BackendHost? backend;
 private bool ready,closing,allowClose,verify;
 private DispatcherTimer? heartbeat;
 public MainWindow(string[] arguments){args=arguments;verify=args.Contains("--verify");InitializeComponent();WebView.DefaultBackgroundColor=System.Drawing.Color.FromArgb(255,245,242,236);}
 private string? Option(string key){var n=Array.IndexOf(args,key);return n>=0&&n+1<args.Length?args[n+1]:null;}
 private async void LoadedWindow(object sender,RoutedEventArgs e){if(SystemParameters.ClientAreaAnimation)((Storyboard)FindResource("StartupMotion")).Begin(this,true);await Start();}
 private async void RetryStartup(object sender,RoutedEventArgs e)=>await Start();
 private async Task Start()
 {
  try
  {
   Retry.Visibility=Visibility.Collapsed;Status.Text="正在检查本地学习服务…";
   var root=BackendHost.LocateRoot();int port=8778;
   var cfg=Path.Combine(root,"runtime.json");if(File.Exists(cfg)){using var j=JsonDocument.Parse(File.ReadAllText(cfg));if(j.RootElement.TryGetProperty("port",out var p))port=p.GetInt32();}
   if(Option("--port") is string custom)port=int.Parse(custom);
   backend?.Dispose();backend=new BackendHost(root,Option("--database")??Path.Combine(root,"data","study.db"),port);await backend.Ensure();
   Status.Text="正在翻开离线资料…";
   string user=verify?Path.Combine(root,".local","native-qa","WebView2"):Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"MathCodeStudy","WebView2");
   var env=await CoreWebView2Environment.CreateAsync(userDataFolder:user);await WebView.EnsureCoreWebView2Async(env);
   WebView.CoreWebView2.Settings.IsStatusBarEnabled=false;
   WebView.CoreWebView2.NavigationStarting+=(_,e)=>{if(!e.Uri.StartsWith(backend.Url,StringComparison.OrdinalIgnoreCase)){e.Cancel=true;OpenExternal(e.Uri);}};
   WebView.CoreWebView2.NewWindowRequested+=(_,e)=>{e.Handled=true;OpenExternal(e.Uri);};
   WebView.CoreWebView2.WebMessageReceived+=async(_,e)=>{try{using var j=JsonDocument.Parse(e.WebMessageAsJson);var type=j.RootElement.GetProperty("type").GetString();if(type=="capture"&&verify){var name=j.RootElement.GetProperty("name").GetString();if(name is "native-math" or "native-cpp-code" or "native-catalogue"){var folder=Path.Combine(root,".local","native-qa");Directory.CreateDirectory(folder);using var stream=File.Create(Path.Combine(folder,name+".png"));await WebView.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,stream);await WebView.CoreWebView2.ExecuteScriptAsync("window.nativeCaptureComplete="+JsonSerializer.Serialize(name));}return;}if(type=="study-ready"){ready=true;((Storyboard)FindResource("StartupMotion")).Stop(this);Loading.Visibility=Visibility.Collapsed;if(verify)await Verify();}else{Status.Text="界面加载失败，请重新检查。";Retry.Visibility=Visibility.Visible;}}catch(Exception ex){Status.Text=ex.Message;}};
   WebView.CoreWebView2.NavigationCompleted+=(_,e)=>{if(!e.IsSuccess){Status.Text="页面加载失败："+e.WebErrorStatus;Retry.Visibility=Visibility.Visible;}};
   WebView.Source=new Uri(backend.Url);
   heartbeat=new DispatcherTimer{Interval=TimeSpan.FromSeconds(30)};heartbeat.Tick+=async(_,_)=>{if(closing)return;try{if(await backend.Ensure()&&!closing)WebView.Reload();}catch(Exception ex){Status.Text=ex.Message;Loading.Visibility=Visibility.Visible;Retry.Visibility=Visibility.Visible;}};heartbeat.Start();
  }catch(Exception ex){Status.Text="启动失败："+ex.Message;Retry.Visibility=Visibility.Visible;if(verify){var root=BackendHost.LocateRoot();Directory.CreateDirectory(Path.Combine(root,".local","native-qa"));File.WriteAllText(Path.Combine(root,".local","native-qa","error.txt"),ex.ToString());allowClose=true;Close();}}
 }
 private void OpenExternal(string value)
 {
  if(backend==null||!Uri.TryCreate(value,UriKind.Absolute,out var uri))return;
  try
  {
   if(uri.AbsoluteUri.StartsWith(backend.Url+"assets/",StringComparison.OrdinalIgnoreCase)){
    var name=Path.GetFileName(uri.LocalPath);var path=Path.Combine(Path.GetDirectoryName(backend.Database)!,"assets",name);
    if(File.Exists(path))Process.Start(new ProcessStartInfo(path){UseShellExecute=true});
   }else if(uri.Scheme=="https"||uri.Scheme=="http")Process.Start(new ProcessStartInfo(uri.AbsoluteUri){UseShellExecute=true});
  }catch(Exception ex){MessageBox.Show(this,ex.Message,"无法打开原件");}
 }
 private async Task Verify()
 {
  if(backend==null)return;
  var folder=Path.Combine(backend.Root,".local","native-qa");Directory.CreateDirectory(folder);
  string report;
  try
  {
   var script=File.ReadAllText(Path.Combine(backend.Root,"scripts","native_acceptance.js"));
   await WebView.CoreWebView2.ExecuteScriptAsync(script);
   for(int n=0;n<240;n++){await Task.Delay(250);var value=await WebView.CoreWebView2.ExecuteScriptAsync("window.nativeAcceptanceResult || null");if(value!="null"){report=value;File.WriteAllText(Path.Combine(folder,"report.json"),report);break;}}
   using var stream=File.Create(Path.Combine(folder,"native-webview.png"));await WebView.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,stream);
   File.WriteAllText(Path.Combine(folder,"host.json"),JsonSerializer.Serialize(new{process=Environment.ProcessId,title=Title,width=ActualWidth,height=ActualHeight,webview=WebView.CoreWebView2.Environment.BrowserVersionString,database=backend.Database,port=backend.Port,visible=IsVisible,ready},new JsonSerializerOptions{WriteIndented=true}));
  }catch(Exception ex){File.WriteAllText(Path.Combine(folder,"error.txt"),ex.ToString());}
  allowClose=true;Close();
 }
 private async void ClosingWindow(object? sender,CancelEventArgs e)
 {
  if(allowClose||!ready||verify)return;
  e.Cancel=true;
  if(closing)return;closing=true;
  try{var dirty=await WebView.CoreWebView2.ExecuteScriptAsync("window.hasUnsavedChanges?.() || false");if(dirty=="true"&&MessageBox.Show(this,"当前个人记录还未保存。关闭并放弃本次修改？","数学 × 编程",MessageBoxButton.YesNo,MessageBoxImage.Question)!=MessageBoxResult.Yes){closing=false;return;}}catch{}
  allowClose=true;Close();
 }
 private void ClosedWindow(object? sender,EventArgs e){closing=true;heartbeat?.Stop();WebView.Dispose();backend?.Dispose();}
}
