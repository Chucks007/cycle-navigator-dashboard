import pandas as pd
from backend.services.macro import MacroService

service = MacroService()
# mimic test data
dates = pd.date_range(start='2022-01-01', periods=13, freq='MS')
vals = [100.0] * 12 + [110.0]
m2_series = pd.Series(vals, index=dates)
from unittest.mock import MagicMock
service._get_series = MagicMock(return_value=m2_series)
res = service.get_liquidity()
print('len', len(res['data']))
for r in res['data']:
    print(r)
print('metadata', res['metadata'])
