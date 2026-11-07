using System;
using System.Collections.Generic;
using System.Drawing.Printing;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Web.WebView2.Core;

partial class Desktop {
 object GetPrinters(){var defaultSettings=new PrinterSettings();return PrinterSettings.InstalledPrinters.Cast<string>().Select(name=>{var p=new PrinterSettings{PrinterName=name};return new{name=name,defaultPrinter=name==defaultSettings.PrinterName,duplex=p.IsValid&&p.CanDuplex};}).ToArray();}
 async Task OutputDocument(string id,Dictionary<string,object> payload,bool physical){
  string temp=null;object result=null;Exception failure=null;
  try{
   string printer=physical?Convert.ToString(payload["printer"]):"";
   int copies=physical?Convert.ToInt32(payload["copies"]):1;
   string duplex=physical?Convert.ToString(payload["duplex"]):"one";
   if(physical){var p=new PrinterSettings{PrinterName=printer};if(!p.IsValid)throw new Exception("La impresora no está disponible en Windows.");if(copies<1||copies>99)throw new Exception("Copias: 1–99.");if(duplex!="one"&&!p.CanDuplex)throw new Exception("La impresora no admite doble faz automática.");}
   var core=view.CoreWebView2;
   var settings=await PrepareOutputSettings(payload["options"]);
   if(physical){settings.PrinterName=printer;settings.Copies=copies;settings.Duplex=duplex=="short"?CoreWebView2PrintDuplex.TwoSidedShortEdge:duplex=="long"?CoreWebView2PrintDuplex.TwoSidedLongEdge:CoreWebView2PrintDuplex.OneSided;var status=await core.PrintAsync(settings);if(status!=CoreWebView2PrintStatus.Succeeded)throw new Exception("Windows no pudo imprimir: "+status);result=new{printed=true,printer=printer};}
   else{temp=Path.Combine(Path.GetTempPath(),"maquetario-"+Guid.NewGuid()+".pdf");if(!await core.PrintToPdfAsync(temp,settings))throw new Exception("No se pudo generar el PDF.");result=new{base64=Convert.ToBase64String(File.ReadAllBytes(temp))};}
  }catch(Exception ex){failure=ex;}
  if(temp!=null&&File.Exists(temp))File.Delete(temp);
  await view.CoreWebView2.ExecuteScriptAsync("window.clearPrint()");
  if(failure!=null)throw failure;Reply(id,result);
 }

 async Task<CoreWebView2PrintSettings> PrepareOutputSettings(object options){
   var core=view.CoreWebView2;
   string geometryJson=await core.ExecuteScriptAsync("window.prepareOutput("+json.Serialize(options)+")");
   var geometry=json.Deserialize<Dictionary<string,object>>(geometryJson);
   if(geometry==null||!geometry.ContainsKey("width"))throw new Exception("No se pudo preparar la salida.");
   bool ready=false;for(int wait=0;wait<100;wait++){if(await core.ExecuteScriptAsync("window.outputReady===true && window.fontOutputReady!==false && window.shapeOutputReady!==false")=="true"){ready=true;break;}await Task.Delay(100);}if(!ready)throw new Exception("Las imágenes no terminaron de preparar la salida.");
   var settings=core.Environment.CreatePrintSettings();settings.ShouldPrintBackgrounds=true;settings.ShouldPrintHeaderAndFooter=false;settings.MarginTop=settings.MarginBottom=settings.MarginLeft=settings.MarginRight=0;settings.PageWidth=Convert.ToDouble(geometry["width"])/25.4;settings.PageHeight=Convert.ToDouble(geometry["height"])/25.4;settings.MediaSize=CoreWebView2PrintMediaSize.Custom;settings.ScaleFactor=1;
   return settings;
 }
}
