import sys
sys.path.insert(0, '.')
try:
    from app.api.v1.endpoints.ocr import router
    print(f'OCR router loaded with {len(router.routes)} routes')
    for r in router.routes:
        print(f'  {r.methods} {r.path}')
    print('SUCCESS: All OCR endpoints verified')
except Exception as e:
    print(f'ERROR: {e}')
    import traceback
    traceback.print_exc()
