using System.Threading;
using System.Windows;
namespace MathCode.Desktop;
public partial class App : Application
{
 private Mutex? mutex;
 private bool owned;
 protected override void OnStartup(StartupEventArgs e)
 {
  base.OnStartup(e);
  bool verify=e.Args.Contains("--verify");
  mutex=new Mutex(true,verify?@"Local\MathCodeStudy-Verify-v1":@"Local\MathCodeStudy-Desktop-v1",out owned);
  if(!owned){MessageBox.Show("数学 × 编程已经打开，请在任务栏切换到应用窗口。","数学 × 编程");Shutdown();return;}
  var window=new MainWindow(e.Args);MainWindow=window;window.Show();
 }
 protected override void OnExit(ExitEventArgs e){if(owned)mutex?.ReleaseMutex();mutex?.Dispose();base.OnExit(e);}
}
