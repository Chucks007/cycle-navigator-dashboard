from types import SimpleNamespace

# yfinance may fail to import on newer Python/protobuf combos (e.g., Python 3.14)
# Wrap import to surface the error but allow module import to succeed for testing
try:
    import yfinance as yf
    _yf_import_error = None
except Exception as e:
    # Create a simple stub so tests can patch attributes like yf.download or yf.Ticker
    def _stub_download(*args, **kwargs):
        raise ImportError("yfinance not available: \"download\" called on stub")

    def _stub_Ticker(*args, **kwargs):
        raise ImportError("yfinance not available: \"Ticker\" called on stub")

    yf = SimpleNamespace(download=_stub_download, Ticker=_stub_Ticker)
    _yf_import_error = e

def get_yf():
    """Returns the yfinance module or the stub."""
    return yf

def get_yf_import_error():
    """Returns the import error if yfinance failed to load, else None."""
    return _yf_import_error
