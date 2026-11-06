using System;
using System.Diagnostics;
using System.IO;
using System.Net;

namespace DiscordObsRelay
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.Title = "Instalador Discord Screen Relay + OBS";
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("==========================================================");
            Console.WriteLine("      INSTALADOR DO RELAY OBS STUDIO + DISCORD");
            Console.WriteLine("==========================================================");
            Console.ResetColor();
            Console.WriteLine();
            Console.WriteLine("Iniciando instalacao automatica...");

            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            string psScript = Path.Combine(appDir, "install-relay.ps1");

            if (!File.Exists(psScript))
            {
                Console.WriteLine("Baixando script complementar de instalacao...");
                try
                {
                    ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072 | SecurityProtocolType.Tls;
                    using (WebClient client = new WebClient())
                    {
                        client.Headers.Add("User-Agent", "Mozilla/5.0");
                        client.DownloadFile("https://raw.githubusercontent.com/M70000/discord-screen/main/relay/install-relay.ps1", psScript);
                    }
                }
                catch (Exception ex)
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("Aviso ao baixar instalador: " + ex.Message);
                    Console.ResetColor();
                }
            }

            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = "powershell.exe";
            psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + psScript + "\"";
            psi.WorkingDirectory = appDir;
            psi.UseShellExecute = false;

            try
            {
                Process proc = Process.Start(psi);
                proc.WaitForExit();
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("Erro ao executar instalador: " + ex.Message);
                Console.ResetColor();
                Console.WriteLine("\nPressione ENTER para sair...");
                Console.ReadLine();
            }
        }
    }
}
