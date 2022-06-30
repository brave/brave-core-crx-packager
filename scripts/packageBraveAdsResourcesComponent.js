/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const commander = require('commander')
const fs = require('fs-extra')
const mkdirp = require('mkdirp')
const path = require('path')
const replace = require('replace-in-file')
const util = require('../lib/util')

const getComponentDataList = () => {
  return [
    {
      locale: 'iso_3166_1_gb',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAttE8dno9TryntLQd2qNsHfmEJDzC2owHBcaPk6j0CEliD+NWiPAD0YmRZc+ckeXsahc5Bwh/Xz1WOzQJLXre8K8qPQhTh+uICNZ88VAWDiyXZQD20BeBZc3qhvHuKE1i1lsEbZzv3KocLCkPloP1Aihvdit8Chia/0KPxgMR1W6gZutg4gQiGVHu3fy99PC+0OVrC0HbHK+8UnNSAdi/oLuovXIfiYWJPCeK4HaeRJRfsWPBr6tWULz9Yz14g4DlujviLAJQwpOrstnFKZNkL4d++q7t3oLN7TSBf84iwimJCcR8sssmFUCOnd183s2PRCJCT9/jgTziUNTROeS/eQIDAQAB',
      id: 'cmdlemldhabgmejfognbhdejendfeikd'
    },
    {
      locale: 'iso_3166_1_jp',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3SIk4j5tQcE9rzhvy2yZovJm5eMF38O1epzXtYGN/kNzQ5VoZy5c+2uUnEcVa/VVsqSZKuWXkqz//OlJ5tDbWKH2bMVYvOXU9QuBqK6ZKrmvsAziO+fxd8LeW/wV6WLLxE8lZKOQ/JCGfj5lYh0cqeLDfWsZcb+odDW7ecKfrfqKZFI+wJeGBLv8nbMmvFApqxP0o33pMihX0McQ62A+pjzB8QbBADu0/+lKb9LkNi34FrTp0AQhSoOWHFYAaqW3/jYIG47/EvmsEiJYwp0/HN5XhHWrdTBTLlLkG9672PslNJYqv57CbOB0yPGKAELTXZzxDNEkPQ2CNV/t4kDlNQIDAQAB',
      id: 'ikolbkmkinegpoedjeklhfnaidmloifj'
    },
    {
      locale: 'iso_3166_1_us',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA7xPk/eeslWG0VSSjMExUQtvn+8Ww8wCuluf97ACxiAoSspSrU1ftrjGw7U72YCKgPk1EdNKyOYpP1jQT0idxrhpTqihJQLlHm5EN3MiLDVf6MK8dqyG4PVAALMTGW6+4c77QhqnVWIRnfep96WBnJo0x5QieMWDZY79k4QMqJ2/NXMbGxyLWrNyXNy7zEnu5O/lLn68dM2it2KaQnXwCWj9DUoeaP6HTbBAgFYFE85b3nuSNX4RJfuEAod4lqdOgGsUuF/99AyCPVijuveYPrKxiBzvTcHb5GWoeKqjLi9rrqEwgxHgHZEANtIvORNQT40Q5OX+WntI1rkhn9UgMiwIDAQAB',
      id: 'iblokdlgekdjophgeonmanpnjihcjkjj'
    },
    {
      locale: 'iso_3166_1_ca',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwSGYa6ZpRmQQNSXZDZCMRZYyUXKqyCaDkHb8mucgKbNCNkwOTgqMKv1dqi1fZrniIIR/dLHb9YwX+gfWb8ZaO5Xhm9H5iqTpo9qk5g0zM7Ba9+2h0nJVPjSuPen84rvzuKqx17I+6GTIc8j/E1O7uRWaqBqLAOHfMAusJNtVSpXlFAvn8iPO3oIxzPwkATVEzc1jLQgxkdVkBZ67Ivp6jRkLd9T5Q2XtcJ6wr0CEzO9ypimyu2NM5Xkfzza0xE54LddrNbFcATg/wpx5B5Mw7zMgEDIhTkaOnv+pHgpKwMamlazH9ivmXvxfR/ToX3uRY+STapbJ4dkd7UBH3XqGWQIDAQAB',
      id: 'lgejdiamednlaeiknhnnjnkofmapfbbf'
    },
    {
      locale: 'iso_3166_1_de',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsem6Ih5+e6dxLjuak9R9hrx/XShs8N+pLqnvoYSqj5XT8d64kC24u7/QOUNvn9lcawT4wikmmHjRB0yDO9VU+Gltm52jFBVlpBaCKAT+cd56D+seIo6IaFnb42tv5wDQ1yQqvEFr2BOTdd5DX8lRmdQLWGZ2zm294xsih8ZjDZtO8CDtlFpUTwv0iGo30aOF6TcWrZ988h0zolO1xMh5MYIJs54+GYqF1cNjk+p4WJl4q/aWdgTxbzIAVvaJUavxYhYwQ0SzlFHDAa24diExS+VC/R+W5ymi7J/V5QPwXpld9sBfRW9/LFIdyzbeGkYtgNCsQPw5J1/FREfD/YZmowIDAQAB',
      id: 'jcncoheihebhhiemmbmpfhkceomfipbj'
    },
    {
      locale: 'iso_3166_1_at',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwtjBxtziOYDWsMtySX36Wl1K+4mrCpr+EPYHSee1IN0VVHeWRxYfbjWUiCQKBOg5Rc2bdyu1lbkjEyYvsEgZQjg9dtA6i6DfXWGmpm6+JTGx6horNiyHBT00yb+i0M915zh1S9zxus7Xj9sa2EdJefvl+Sd6wcCpVb9kJveAKUtHqcTReUkXkEw0o50/E3UaPs0619APiTFbnOSdOGhu3atBsPV2x7wIlygpdIYpB4fP4Z1C6MQHaWJ7qxsVylWZpidblCeC3X/pF4GGA7M+CmsaJfDu6O4PTftAaqIPAba2dDYPa/f6/NCI+5NlQHULdIRkCWkkWtBhvJvoavsdqwIDAQAB',
      id: 'jmneklmcodckmpipiekkfaokobhkflep'
    },
    {
      locale: 'iso_3166_1_ch',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3Uiy25uPXaFMtJF5+tB4Y7eXB0fpCXeTI3gx19W5hjneipXUIOzLZ0d4KKbeLAckYmwlaMsq4H9EQMfRKnQTGvncAlteAOMZyVCcVN6LpfeJlT9hYOyg/NMfudxrKBoE+KAAudPMHTN8TWJ4abOCGcAGAIzXX574nth2aqm7bBQu2R5ulAg+W2M4D+4GIJNk7VMa9AJWLwiioIypObieWrf0gtvGnceqjM+QT2tMweWgNmUwHhoDKht+e7ssufpQHLWBzLPrRKhu6jTLODrreXdwFGZ5RgZWoFsI8J9wmRHGYUBfE/ARq5lVYXxTzwou1LwxwaZfOB3mkRseorGD0wIDAQAB',
      id: 'gnamhdlealpfbanappoephfdjeoehggd'
    },
    {
      locale: 'iso_3166_1_be',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtH3+qC/78pPp89oDElZclPvbQdukfG36kOPleQZU/MVDDWvnRj7S6Ax70QzoYbkKRn0fKpfshXB9/ew6oHm685ixje3zwhSFLzNWjYT9GMm/ISxOAaiomlVAshX2oUI//ZB7+SMxf7WCojFpfJ03M+ECGVquNZvUh81fKkN5a0pgEGFNLlP5aCOjLYO4O9xAaAFRUPIYkjLuyC3sQptz6YEjNHTHZdgjV+i02I3MbZexAAzsQRny4SZ+OtNzAOPzfl9KgAo89cdEpxYtd2GNc6Fbe4KjM3nat0ExNzKfONhPWt0HmoNV5gyhAiqu0XUuHvA4EBg6gsOETZOrSUi5nwIDAQAB',
      id: 'lnbdfmpjjckjhnmahgdojnfnmdmpebfn'
    },
    {
      locale: 'iso_3166_1_au',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAk5hzzDC2Iq6oGC2CEhZixqq3V62xuReBQphzi0mnEYugQK4Ai0ZCF2LQ2iUKRiKJlm8Ul/hqD4p5lmNXCfcCH/IZ1OBWXSkY+mxemuXbBEJNR7XRY99Y11vldH+Q8ZZmv0tTe7Me2L9Faw7d1EK+RW0s46l8dnRSChw2Nxwt99tHYiEk+iIE8F/WiUAkOQ+cvQwlaLvsL2G3W0kqgvXoWCAIBL1Uwo9fx9Jj7HNLSPTjoOCbOTwowmWb+16KU5ufJk7kMg+ApYJwh8fwrBL+Tw1OotIHDe99kQujsWjL2k6RrG7yCJKi+mozQVDmrd6MLZFguMWC51d1jHkPK0dhQwIDAQAB',
      id: 'kklfafolbojbonkjgifmmkdmaaimminj'
    },
    {
      locale: 'iso_3166_1_nz',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvcyuC5PcR1HRdtVGjmC2FT7mY50SkMrpYtaXNI/L7TDZk0/CBp1Zxc+DGqEbzo3avCnVX56zMAyAEfkvYZFst/NwepP9lBWsfN+nN+8+gXmCN93ATPu/2UNnyh7QnfE92DKt61+7DNpimhzv+7exzYPPj1HDe6RVgpTxT31b9XzLgBQadS6lNyZ7l58yFGb/b3I7nEEKPwop2M3oxn8uKLYituODG5Naj1aVJsFv3HgbPSkdauoIog5gcxA3lA0k3yIRiWJiQs0TkusE4Wq9sIBNts071AZ77U0EIMgplcV+Vuh6Zh9/iVKXWUdUcY5eEVFPrD6ElTu7h0MC8gln7wIDAQAB',
      id: 'dlbokjgcdlhkgfeklggoncjhihaebnai'
    },
    {
      locale: 'iso_3166_1_pt',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwBwlUQPOENLpI4J0hiO2xCIwVQRMEoM0Eqsf1YZ4kUV2QzhLmZ3ScHw/YtEh2Uz7hE/bLRwkENY/OdJ6/gqL9NxirXKuTt1kF3ejxYAxh1lwicUb15W4S+8wSWaal3CGVOqCih/oXXI+0SLETBplLhPSfMWMwBB0jxj6axEGGYexDnIrXXibSaKc+7U/wYB/I7PhojLWvVOqEMU6aPfE01F+5b/8XCcgjixUFkpwCO3MLH5zbSfh0dCDYWGTVdF/np0hvMfksb8HBNR8V76TIbBimrCCaVLW5wbAxezBBOfkWkhzUt4Qn2WDwoAIFY9U/aK4huV7uzHx2nNN3nozIQIDAQAB',
      id: 'gchnahcajhccobheiedkgdpfboljkhge'
    },
    {
      locale: 'iso_3166_1_fr',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1CVf+LPIqWzGBD2sAXjaUvM8oYMRqosWNeiseX2dfLJ5H+Bz9JgtaiYfFGGOiq2D/44c8ona+K/j8F4Ta0WbDFUCJTCFMoYLQgxNjsDiYhTSCCxX8wQwbOOFdNJppiqVLfp9Up6tb/KiKpMqZoJLqx8hT0uOvVD08d4yy+HMLXBbSPG8Vp11pCWcADmc+KZHORZHN1rwh5sSQ6iCgfQKxVH7P/2o762216Wtsswjg1TQtoYt6w3d8VUSXR3012R51CWi69YW9UFh0rDoD0FYKRGFo3YFbHrWmvU4UpR8MYX1ZJ5x9q81nRtb5F1bRjQ8uo1p4gbcqtQTj2CTbEospwIDAQAB',
      id: 'bgifagoclclhhoflocdefiklgodpihog'
    },
    {
      locale: 'iso_3166_1_nl',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAx2O6QI9v3dyu6TnZuRdETciQUm5rITTKYd4IuHLB0OWd8lwzQOYEpfZ5SSwlW3pDZ/e8SJENAs6h/u+G/ih9xRjxEhhMQ5wfuQW7dyDIS3eA/6d4zUUAPaZzJtuZaM8HYMjUGZ+qf2oWsZLCEDkynR+Fy8/6hsV54FtaKhI39iIhovPd+7UzggCTPi3dSYrDPN93udESK/ssRhguU+85tm/EbrTXLFP+jgtvRd+igT+hxYcCDjcsXqMF4Oo5hSwH1Qr9I1MNmjnR7hmyW7ABv4Soq6/E2GIPAoohNjWsTi3UtAcKohoxAFsVbJ4udEUx2r/tLZ6JKxfKnEyNdLv6NQIDAQAB',
      id: 'choggjlbfndjppfiidbhmefapnlhcdhe'
    },
    {
      locale: 'iso_3166_1_dk',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvqplRBBvHN3xdtjXFYoNZDZOOHAp0OIBHfTYeXt2f0MTjRq029rLurs1vYl7BRxySK5ni5pMUwBo/3AHnHASv4FMAcuyCUPYRcz6c3cjZLo6jjQSTnIGbNTPAv2xSnRV54/8INN995EOGdWYWth5Tp9pSP13qhQ4jjwiwvL2QMlw90sdBbf9FASoWRMpBGvtbZe5fDwZ5cdDd/rD+Yi+RVfqMQD46U8ou/b+eM12ChTwrsY/4mNhhfZpBMGiYrfKntdt6b88q5V36I2x+qQxmQxLvwm1Y9L+wozlTWktsS2/YPoi2ckeUFnz3ML2ZfFIah+KXCsPt6FastYYFb7ufwIDAQAB',
      id: 'kmfkbonhconlbieplamnikedgfbggail'
    },
    {
      locale: 'iso_3166_1_es',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1zaPIrSz2eCNo9YaYAmVeRGaxd9YIN17HToc7ij6RYouA0Aqxgj25QnlZNrBrCnX4ZmrP+nf8oyetv+hzrA9pimZLAk7JrQFC3MG/66AYRpwGSaJCAkVSdCMOYnkF4EGuSj6T7SdxWvADtKeoPV4JsXZTwhfhTNpp670MkL9vHUJw400XpHLff/tVJ7H0GruT1pIIC8ZXpwG1M0/39BovSEj7kBkvMy4HeclXzygaFcHue3TNMIGSQLIDUy/9MpZbMvN4eoK1c5765GrEOMJDEgRjfuLR+2diwRiZE9ykFWT54oH+M3uQCL02BIiywhvhV6CWI78zsQXzfJJRga1RwIDAQAB',
      id: 'ganmbmiebelpdlnohnabgkkocholelbp'
    },
    {
      locale: 'iso_3166_1_fi',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzCJs5hip1FIt9I794Yxf6SbE146CSR8RsSybr2HBGe05g3mAjzeax9uUt/ZemFMj2pdZKKyS1TS4TEpT/b4Rt7eLIDSvapmggMAq0O8CNn1jIusibB3nLOGK8Wc+jAbgnX+5AvhTbGPTL5r6Nu3YfT37UhiUdrtqh3HqxiF+mZqZfNbgV6hFizNBcoMbdNPBJ02aIyrza7Ehow1xCaq/1PHCfsXO8SrOBZwMgPkb5G8zaUy5Wqn3/usiJPbpRFmB8ULVx726Od7jGXaFQ2mVi+BADzFiwQgaR9QP0egGqtfAaE61x0taf6OoNjEIwV+QHfJmH4bd8q9ePkQjP+DxnQIDAQAB',
      id: 'ecneelfoifpgnignhipdebhbkgcphmic'
    },
    {
      locale: 'iso_3166_1_hk',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0ZviPzaj197xS7xwSodU/1u/9E0Sr/dSf9m/WKDeQ86Q12z8C8QeMqbI1OPQSUb+QN2OKMQeO6oJhTk69bkxZs2q6o/C4WZEgrEjjM4Tpl+d7rVNKEgC2PFVPrd2TBvbXu0aD/yJF+zBadCshEcqbV6pDLTPnxW9LyXJMn8hL1F7z+E1sk4o5yRkZHJ3mG96tEZQG9QRRistw6YNaLtXs0+/DlFnYP/8dHuoaA2BLUurck/hhYlypyFQL2p0IvMQsDyhvefqvNXnjLzUax2CAf4zUHOfM5U8xdIwOgDoi1yceoF4zZsFdTJRxT4HrgMpZO7pnkummIUCUsj8p//XLwIDAQAB',
      id: 'plpcpclbpkilccbegfbpediidmejaahc'
    },
    {
      locale: 'iso_3166_1_hu',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtXRq4rxAGowG3BhkEGMG8coYZ2Beth0q09cc/K09y61X8QhHGk9vslos1InDpsSKU0pTb2YvqXEUJJ/HVx9Ehm0Uk4a+2TCir6HzmjEmyV+m59ImN0/MyZbKUzMXzaBXxEpMQX+tupJ+bas36if0SASxTxhI3TKKug+q/MxwUcmqriuBQ56sc/ipAmdMWBsUNqLxHdamxFvgi6eo+GPM3qZVDyqRb37OmVSnhXMDm0jbFBBoMc89WFLDQHS9EuEiAAzv6U/EVuJrUnNAJQhzjqRwT1WkV0melCPLZXfE5z6KIkpQN+ghDFxyxDJy3JmshEqnrYe2ZZr3mFh41Bix6wIDAQAB',
      id: 'pofhnfhkonpjephlcjlmbjmlikiaddoc'
    },
    {
      locale: 'iso_3166_1_ie',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApEj08iVd05MU1JHL6kzFJarSlyJ7uXR7X7N80ZvUtPHeTd2tMWaQOaPSdGxIn0OZq3yi1MA2sEwDZZeeoAV/B/ZpfxvaiA3rsOIfdDzPJc04HXjLMTYY++xEofxRpwfAHwzxeuPrVCz6LiqdRiN6xlnf7HS1WVvgzrVcIho7JWBWJ/m5i45l7WLHLiaw9rBWJI0AN7VenvY430oUQk8ndl46e1G7WJjnQmSaITxbHFf9xinBak67gnag0vmtzB4QDsUVLIsI0sj9s4IAfNv6+5y3RZyCfebJI9Exea6GMTq/ArXv9zM4vx5Ux2I1IXCwMdeWGexLSIUlVficDSxydQIDAQAB',
      id: 'fbmfelhaipnlicodibhjkmeafbcgpfnm'
    },
    {
      locale: 'iso_3166_1_it',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyOcTaix+0SkqB8PwsuU2cI5jXMpt8zrR7nd6zYbgVrdwTQTSTh2aBQ0H+1IXcsYqfOkkGXmilEjl/er0us47WmSMf2j2KbY4MgSyAcyfWfZIkoM965j82ocW9AaNoJhdm0BHcKrRkdyx7H5xdJ1G/aEHVwaWHh9+xegeuMgEbcJeLZuD6TuUXBqf2r94s0ngFx0YhQXAAdAkLbIjkdJnL4WQXCRkZnKyhq3ZbQawbWiZOAKLeqOsqhAW0/iWMtO1c9jnTMu82hCqNGavrJy4fUZTsG05uqrgEccAd+n+xnClmyBvVuy8dOQwpda3xLCuAawbQ52zog3t0erZv4EzOwIDAQAB',
      id: 'gjkhegliajlngffafldbadcnpfegmkmb'
    },
    {
      locale: 'iso_3166_1_kr',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApnJYbP+JKDz+de0z6wjJsH1P8GibZNjJfNhwXpvGdDk10DnsmBt8BSOAuQiz/NvhQD0DM3ESBzf4zrHag1wNqSEq97meaTC7GoysZL/ck1+IrTvES00xbGvDyB4k3/V/uOMnsWL/60+5fqp6xZHua7uvvk+Un6kzrfN6TFEQLbbAId3pGPLDG/gZPORsWZ0gNjESjPEfUTFndsQ2TggpdOIcg2z6q5HA9UL+TcBdo3393WA32ns0yTrWelzOQu0CgCY/cHJflYIYh20q3os9CQlmstKnrmUMy9PZun6IAv5vwcApIUP7e1qgFle4JBR19p1mG9jxAUbaMhOzy/BdbwIDAQAB',
      id: 'clgbjhhcdihjgbomhpmfdjdiagejadja'
    },
    {
      locale: 'iso_3166_1_no',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyZKzD0vsJiAjHO/8uuWWo7Hy0L1CjkebMsRtWHEbiouFFx7KoDnnMsqR5iIAh85tH/f+0qwYSmhdZq33dJrKCqB/ue/O4GpCnDun688bemS6NNk1dVW+ckkPgUyG0ryd9OI9PGuX9WZ+bHLR3PrbxA8V80wKGtrnsF4FQQX/H52XIL14bKLBcIsuAZxNhGo9w4dlkci+0OX8DihHria09SE+5yVBVBLBLphQO0MEfn/NzhGPoHk6/nO5os3Py7uUKCHeJ7FdGLkOIepbEgxEMfWKeK5AVm3ju3OgnHrfIYv4NxnWeLiffxD43IWnRo6oieKkmMnr0XS9VVpyDeubYQIDAQAB',
      id: 'ciibjdmjfejjghmnlonlihnjodfckfbo'
    },
    {
      locale: 'iso_3166_1_se',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsRryX/hkG5fAzIF+Fa2/FbkkpvRSxNvwpTpXTj0TAZjONDoMrbyiLLG7ehQOTAUGHumRfqUYeQqsz4gz2WeYj7LKmSTXe9RIF4nZPwcj83PYGuGXipVfxxtFS9hc7tVpdWgtKZT80u7h5orEJyM1XN89oOcUED4dj+py/xtKcGlQjM161Vr7pj0RevzrcjzAuM11lPVlnQ0598TBVlBQV/Mz5KvmTHzQOPo3D7Xpr/YjA/1XaN7BsdSscXI0GS6klegki3vyYUZsl7jvfyPEnJxqm2eVuv7rt3C2TOIpUUln6bU+tyIBCOirLJ2ouCgpsrtsAynteFN/QsksLJoauwIDAQAB',
      id: 'clncjboijmbkcjgkechfhalginbnplpp'
    },
    {
      locale: 'iso_3166_1_sg',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlEtSW70q9ZmdPQ1/1dEvrMCYWu+p/WY6dZPf/yOsYhy8O0W+NI9jO3Ydg9GI1PQcnq7Mo9YPXkIe+lUsoMiIybRhyeDDfdnqSrAvF/YNzDcl7OxxCby4OpdzRWvHAVgKmYxbwlRRa9Btdr6PPQNxd9AHUQGfh24xfBI84UASnZkXnmAT5FmPtlDGWrRqiwld2Io6X4onMvVGGqx3nXzR4AoK71Gzsh5oW0KMPHPXsHM66KOQ8R6fLgXWYiN3t6udY51Gg0uJRoF0SDeSI1BbY7co6qcmNN4os5cxiRBywTE6ZEsXYEX5/cewYbz1RN+84aPNxLbZcYjjgSo5QH9Z8QIDAQAB',
      id: 'jilipkheolgjanjhhhdmbaleiiblnepe'
    },
    {
      locale: 'iso_3166_1_tw',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA7e70YXA14qNbN0ZIuFC9N7HLJKiFasV/y6ccYKkTyiBZ284CVQjZpVj7hLDgT2f1qHSUk2MxHZ+PF61+gWtG6EjbX52dQXNgicURoVA4p/Jq0GA/dR+RUYmxI3QP8wzjbpn/JB7MFi5tPdmtIfLXAZU4cgPbB3CuARV3XvyK5o61SQq+ytwJFKRAp16om5AWQa7Tnv1tQhZqJX+/nhUELMbNRXzxF+QvOQLmwqJMvWgT3IXe+L6xC6hq4/2yFw5zB9qV7eKCuohd8Q69Pm5p0mm5jRvRXsmkthxt9s7qES0dW6vkTaZUQiU/5Qa4I8Ak2H22XHhAswRGDokv8ksMZQIDAQAB',
      id: 'jejmkjlhckkijknapfhfoogakgoelhen'
    }
  ]
}

const stageFiles = (locale, version, outputDir) => {
  // Copy resources and manifest file to outputDir.
  // Copy resource files
  const resourceDir = path.join(path.resolve(), 'build', 'user-model-installer', 'resources', locale, '/')
  console.log('copy dir:', resourceDir, ' to:', outputDir)
  fs.copySync(resourceDir, outputDir)

  // Fix up the manifest version
  const originalManifest = getOriginalManifest(locale)
  const outputManifest = path.join(outputDir, 'manifest.json')
  console.log('copy manifest file: ', originalManifest, ' to: ', outputManifest)
  const replaceOptions = {
    files: outputManifest,
    from: /0\.0\.0/,
    to: version
  }
  fs.copyFileSync(originalManifest, outputManifest)
  replace.sync(replaceOptions)
}

const generateManifestFile = (componentData) => {
  const manifestFile = getOriginalManifest(componentData.locale)
  const manifestContent = {
    description: 'Brave Ads Resources Component',
    key: componentData.key,
    manifest_version: 2,
    name: 'Brave Ads Resources',
    version: '0.0.0'
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifestContent))
}

const generateManifestFiles = () => {
  getComponentDataList().forEach(generateManifestFile)
}

const getManifestsDir = () => {
  const targetResourceDir = path.join(path.resolve(), 'build', 'user-model-installer', 'manifiest-files')
  mkdirp.sync(targetResourceDir)
  return targetResourceDir
}

const getOriginalManifest = (locale) => {
  return path.join(getManifestsDir(), `${locale}-manifest.json`)
}

const generateCRXFile = (binary, endpoint, region, keyDir, publisherProofKey,
  componentData) => {
  const locale = componentData.locale
  const rootBuildDir = path.join(path.resolve(), 'build', 'user-model-installer')
  const stagingDir = path.join(rootBuildDir, 'staging', locale)
  const crxOutputDir = path.join(rootBuildDir, 'output')
  mkdirp.sync(stagingDir)
  mkdirp.sync(crxOutputDir)
  util.getNextVersion(endpoint, region, componentData.id).then((version) => {
    const crxFile = path.join(crxOutputDir, `user-model-installer-${locale}.crx`)
    const privateKeyFile = path.join(keyDir, `user-model-installer-${locale}.pem`)
    stageFiles(locale, version, stagingDir)
    util.generateCRXFile(binary, crxFile, privateKeyFile, publisherProofKey,
      stagingDir)
    console.log(`Generated ${crxFile} with version number ${version}`)
  })
}

util.installErrorHandlers()

util.addCommonScriptOptions(
  commander
    .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files'))
  .parse(process.argv)

let keyDir = ''
if (fs.existsSync(commander.keysDirectory)) {
  keyDir = commander.keysDirectory
} else {
  throw new Error('Missing or invalid private key directory')
}

util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
  generateManifestFiles()
  getComponentDataList().forEach(
    generateCRXFile.bind(null, commander.binary, commander.endpoint,
      commander.region, keyDir,
      commander.publisherProofKey))
})
