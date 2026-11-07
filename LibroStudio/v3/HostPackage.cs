using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows.Forms;

partial class Desktop {
 const string PackageManifest = "maquetario-paquete.json";
 List<FontRecord> packageFaces = new List<FontRecord>();

 List<FontRecord> AvailableFonts() {
  lock(fontLock) return packageFaces.Concat(fontCatalog).GroupBy(face=>face.id).Select(group=>group.First()).ToList();
 }

 void SetPackageFonts(string project) {
  var faces = new List<FontRecord>();
  if (project != null) try {
   string folder = Path.GetDirectoryName(project);
   var manifest = new FileInfo(Path.Combine(folder,PackageManifest));
   if (manifest.Exists && manifest.Length < 1000000) {
    var data = json.Deserialize<Dictionary<string,object>>(File.ReadAllText(manifest.FullName));
    if (Convert.ToString(data["project"]) == Path.GetFileName(project)) {
     foreach (string file in json.ConvertToType<string[]>(data["fonts"]).Take(500)) {
      if (!Regex.IsMatch(file,@"\A[0-9A-F]{24}\.(otf|ttf)\z")) continue;
      try {
       var info = new FileInfo(Path.Combine(folder,"Fuentes",file));
       if (!info.Exists || info.Length > 40000000) continue;
       var face = OpenTypeReader.Read(info.FullName).FirstOrDefault();
       if (face != null) {
        face.id = Path.GetFileNameWithoutExtension(file);
        faces.Add(face);
       }
      } catch (IOException) {} catch (ArgumentException) {}
     }
    }
   }
  } catch {}
  lock(fontLock) packageFaces = faces;
 }

 static void CollectPackageImages(object value, HashSet<string> images) {
  var map = value as Dictionary<string,object>;
  if (map != null) {
   foreach (var item in map) {
    var source = item.Value as string;
    if ((item.Key=="src" || item.Key=="image") && source != null && source.StartsWith("data:image/",StringComparison.Ordinal)) images.Add(source);
    else CollectPackageImages(item.Value,images);
   }
  } else if (!(value is string) && value is IEnumerable) {
   foreach (object item in (IEnumerable)value) CollectPackageImages(item,images);
  }
 }

 async Task PackageProject(string id, Dictionary<string,object> payload) {
  string parent;
  using (var dialog = new FolderBrowserDialog { Description="Elegí dónde crear la carpeta del paquete de Maquetario",ShowNewFolderButton=true }) {
   if (dialog.ShowDialog(this) != DialogResult.OK) { Reply(id,null);return; }
   parent = Path.GetFullPath(dialog.SelectedPath);
  }
  Reply(id,await CreateProjectPackage(parent,payload));
 }

 async Task<object> CreateProjectPackage(string parent, Dictionary<string,object> payload) {
  string content = Convert.ToString(payload["project"]);
  if (content.Length > 80000000) throw new Exception("El proyecto supera 80 MB.");
  var project = json.Deserialize<Dictionary<string,object>>(content);
  string name = CleanName(Convert.ToString(project["title"])).Trim().TrimEnd('.');
  name = name.Length > 72 ? name.Substring(0,72).TrimEnd('.') : name;
  string filename = "Maquetario - "+name;
  string stage = Path.Combine(parent,".maquetario-"+Guid.NewGuid().ToString("N"));
  string final = Path.Combine(parent,filename);
  for (int number=2;Directory.Exists(final)||File.Exists(final);number++) final=Path.Combine(parent,filename+" ("+number+")");
  var fontNames = new List<string>();
  var omitted = new List<string>();
  int imageCount = 0;
  bool hasCover = project.ContainsKey("cover") && project["cover"] != null;
  bool copyFonts = Convert.ToBoolean(payload["copyFonts"]);
  var fonts = AvailableFonts().ToDictionary(face=>face.id);
  var wanted = json.ConvertToType<Dictionary<string,string>>(payload["fonts"]);
  Directory.CreateDirectory(stage);
  Exception failure = null;
  try {
   string projectFile = filename+".mqt";
   await Task.Run(()=>{
    File.WriteAllText(Path.Combine(stage,projectFile),content,Encoding.UTF8);
    string pictures = Directory.CreateDirectory(Path.Combine(stage,"Imágenes")).FullName;
    string fontFolder = Directory.CreateDirectory(Path.Combine(stage,"Fuentes")).FullName;
    var images = new HashSet<string>(StringComparer.Ordinal);
    CollectPackageImages(project,images);
    foreach (string image in images) {
     int separator = image.IndexOf(',');
     if (separator < 0) continue;
     string mime = image.Substring(0,separator);
     string extension;
     switch (mime) {
      case "data:image/png;base64":extension=".png";break;
      case "data:image/jpeg;base64":extension=".jpg";break;
      case "data:image/webp;base64":extension=".webp";break;
      case "data:image/svg+xml;base64":extension=".svg";break;
      default:continue;
     }
     File.WriteAllBytes(Path.Combine(pictures,"Imagen-"+(++imageCount).ToString("D3")+extension),Convert.FromBase64String(image.Substring(separator+1)));
    }
    foreach (var item in wanted.Take(500)) {
     FontRecord face;
     if (!copyFonts || !fonts.TryGetValue(item.Key,out face)) { omitted.Add(item.Value);continue; }
     try {
      var bytes = OpenTypeReader.Face(face);
      if (bytes.Length > 40000000 || !OpenTypeReader.CanPackage(bytes)) { omitted.Add(item.Value);continue; }
      string file = face.id+(Encoding.ASCII.GetString(bytes,0,4)=="OTTO"?".otf":".ttf");
      File.WriteAllBytes(Path.Combine(fontFolder,file),bytes);
      fontNames.Add(file);
     } catch (IOException) { omitted.Add(item.Value); } catch (ArgumentException) { omitted.Add(item.Value); }
    }
   });
   await WritePackagePdf(Path.Combine(stage,"Interior.pdf"),new{mode="reading",paper="book",fit=false,headers=true,folios=true});
   if (hasCover) await WritePackagePdf(Path.Combine(stage,"Cubierta.pdf"),new{kind="cover",paper="actual",crop=true,fit=false});
   File.WriteAllText(Path.Combine(stage,PackageManifest),json.Serialize(new{project=projectFile,fonts=fontNames}),Encoding.UTF8);
   File.WriteAllText(Path.Combine(stage,"LEEME.txt"),
    "Maquetario\r\nAbrí "+projectFile+" con Maquetario 3.24 o posterior. Llevá esta carpeta completa.\r\n"+
    "Las imágenes del proyecto están incorporadas en el .mqt. La carpeta Imágenes guarda copias reutilizables.\r\n"+
    "Las fuentes incluidas se cargan al abrir el .mqt de esta carpeta.\r\n"+
    "Fuentes sin copia en el paquete: "+(omitted.Count==0?"ninguna":string.Join(", ",omitted.Distinct()))+".\r\n",Encoding.UTF8);
   Directory.Move(stage,final);
  } catch (Exception error) { failure = error; }
  try { await view.CoreWebView2.ExecuteScriptAsync("window.clearPrint()"); } finally {
    // Only remove the unique staging directory created by this operation.
    if (Directory.Exists(stage) && string.Equals(Path.GetDirectoryName(Path.GetFullPath(stage)),Path.GetFullPath(parent),StringComparison.OrdinalIgnoreCase))
     Directory.Delete(stage,true);
  }
  if (failure != null) throw failure;
  return new{path=final,images=imageCount,fonts=fontNames.Count,omitted=omitted.Distinct().ToArray(),cover=hasCover};
 }

 async Task WritePackagePdf(string file, object options) {
  var settings = await PrepareOutputSettings(options);
  if (!await view.CoreWebView2.PrintToPdfAsync(file,settings)) throw new Exception("No se pudo generar "+Path.GetFileName(file)+".");
 }

 async Task<object> CheckPackage() {
  string tempRoot = Path.GetFullPath(Path.GetTempPath());
  string folder = Path.Combine(tempRoot,"maquetario-test-"+Guid.NewGuid().ToString("N"));
  Directory.CreateDirectory(folder);
  var previous = packageFaces;
  try {
   var sample = OpenTypeReader.Read(Path.Combine(Launcher.Assets,"fonts","DM-Sans-400.ttf")).First();
   lock(fontLock) packageFaces = new List<FontRecord>{sample};
   string script = "window.preparePackageProof("+json.Serialize(sample.id)+")";
   string request = json.Deserialize<string>(await view.CoreWebView2.ExecuteScriptAsync(script));
   await CreateProjectPackage(folder,json.Deserialize<Dictionary<string,object>>(request));
   string result = Directory.GetDirectories(folder).Single();
   string file = Directory.GetFiles(result,"*.mqt").Single();
   SetPackageFonts(file);
   if (!packageFaces.Any(face=>face.id==sample.id && face.family==sample.family)) throw new Exception("La fuente no se pudo reabrir desde el paquete.");
   if (Directory.GetFiles(Path.Combine(result,"Imágenes"),"*.svg").Length!=1) throw new Exception("Falta la imagen del paquete.");
   foreach(string pdf in new[]{"Interior.pdf","Cubierta.pdf"}) {
    using(var stream = File.OpenRead(Path.Combine(result,pdf))) {
     var prefix = new byte[5];
     if(stream.Read(prefix,0,5)!=5 || Encoding.ASCII.GetString(prefix)!="%PDF-") throw new Exception("PDF inválido: "+pdf);
    }
   }
   return new {ok=true,checks=new[]{"Proyecto y copia SVG en la carpeta","PDF interior y cubierta generados","Fuente recargada usando el identificador original"}};
  } finally {
   lock(fontLock) packageFaces=previous;
   if (string.Equals(Path.GetDirectoryName(Path.GetFullPath(folder)),tempRoot.TrimEnd(Path.DirectorySeparatorChar),StringComparison.OrdinalIgnoreCase))
    Directory.Delete(folder,true);
  }
 }
}

static partial class OpenTypeReader {
 public static bool CanPackage(byte[] bytes) {
  var tables = Tables(bytes,0);
  if (!tables.ContainsKey("OS/2") || tables["OS/2"][1]<10) return false;
  int flags = U16(bytes,tables["OS/2"][0]+8);
  return (flags&0x0206)==0;
 }
}
