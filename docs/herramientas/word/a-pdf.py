# Convierte .docx a .pdf con LibreOffice actualizando antes el índice.
import subprocess, sys, time, os, uno
from com.sun.star.beans import PropertyValue
def prop(n, v):
    p = PropertyValue(); p.Name = n; p.Value = v; return p
proc = subprocess.Popen(['soffice', '--headless', '--invisible', '--norestore', '--accept=socket,host=localhost,port=2002;urp;'])
ctx = None
for _ in range(60):
    try:
        local = uno.getComponentContext()
        res = local.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', local)
        ctx = res.resolve('uno:socket,host=localhost,port=2002;urp;StarOffice.ComponentContext'); break
    except Exception: time.sleep(1)
desk = ctx.ServiceManager.createInstanceWithContext('com.sun.star.frame.Desktop', ctx)
for f in sys.argv[1:]:
    url = uno.systemPathToFileUrl(os.path.abspath(f))
    doc = desk.loadComponentFromURL(url, '_blank', 0, (prop('Hidden', True),))
    idx = doc.getDocumentIndexes()
    for i in range(idx.getCount()): idx.getByIndex(i).update()
    doc.refresh()
    for i in range(idx.getCount()): idx.getByIndex(i).update()
    doc.storeToURL(uno.systemPathToFileUrl(os.path.abspath(f[:-5] + '.pdf')), (prop('FilterName', 'writer_pdf_Export'),))
    doc.close(True); print('  pdf', f)
try: desk.terminate()
except Exception: pass
proc.wait(timeout=30)
