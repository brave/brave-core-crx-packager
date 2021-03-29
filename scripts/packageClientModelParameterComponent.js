/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

 const childProcess = require('child_process')
 const commander = require('commander')
 const fs = require('fs-extra')
 const mkdirp = require('mkdirp')
 const path = require('path')
 const replace = require('replace-in-file')
 const util = require('../lib/util')

 const getComponentDataList = () => {
  return [
    { locale: 'iso_3166_1_gb',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA7L65ymlZt+jRoLsulYP60EtHUcVL+BNs9qdJMDP+UvPlN/eHrjaaRy5uJgQCyTVP1cS20GCTD/d4YhNtMSoNiMfaIInaHzxx4nRu2ipfrpzrypV7LmmDCajrlsIwhiRvDevn8057/k4+J9TuDR3JuRTcCXxNv+LNHCYNcE2DKQDACv1c4CQ6sqasmkhle49UBrhKLiu/mSKmLBAJ45mRNwpKXtFMzNZB2US0BynoHco1rJIVrtx3Y2K2JBW1DqDohrb76J6+2KzcR7Zx55Haca7MhGZ9Mf9+tf5rzjdjIewF79PbX8xNMb0xmw05fekAjJjeLrJygL7BKQNN4BashQIDAQAB',
      id: 'cdjnpippjnphaeahihhpafnneefcnnfh' },
    { locale: 'iso_3166_1_jp',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArBgclTrukKlWqH47I5tP+i/agOow6Kb6UW0pW9FjrfQ26kFiTfYaTFPEBGcM2Qh8pu5fPWI1R2lF1elmF+JKZMdx5286SMuOpfKL8gekfYolt/wDRPNJgPdEleZwGXL3FJVwb5yYee2hFsDlXgDBuR24HwGsZ/bZolnLkMMtonsBzD8IDNyGBEsBOjIRePrShaCFiqLJqcFhTQtLAOCWqmU1Cmf5PxIiBSD3egFQXSdnuDwtORMXqcx9WOQeddtaQKTskHHZyPAbQZhV6h7GFjxMz7EZxrkPBiDiB4p7AcHwI6ZrjvJFzB5AvO7E0SMr6PUJ0DW9G6N21sX0vcBnMwIDAQAB',
      id: 'ienmdlgalnmefnpjggommgdilkklopof' },
    { locale: 'iso_3166_1_us',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA09bImTdimqDHKRK9SGQrxfLxwCVC/fNbPskVhhdyqLV7KsNA4isJaInByxgAllOc0xAXgeSTUx8iq7+33mwj3tZUYxaL3e57NjTQ4Ymm38UIjAD+yS+Wh5icdOW4EtMN41EMEJTrQup9WsKU+SxzL/+A/jcYdrkRMZKHixKHrQxnZ5QUrPitV54/YD+kcYNmGVFpQcHn8fJbvNSLchaFi7D+3KQSWwIS/psPG/Ni3Xi2PcSPRTMN9O09lNyyjA+twFqNhSd13IHlDTVEWE4a0MIR3/4MNQHLMLhchoDokc0Hy+ysSy0ipDCh0iTwLt4FhsMS9e2vIXG9IpzNqE4EbQIDAQAB',
      id: 'kkjipiepeooghlclkedllogndmohhnhi' },
    { locale: 'iso_3166_1_ca',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxhI2yhy1vb6QcmKS+atjzXnNPbtDPX0svPt/A0SPWbCpcMAupfhlKLBOOnc0pSWJM7HtfUoHqXxgYV56EiBvhgNDWinW8gXmQoIXRJigYS8g9MgV1TRaQ3CdHCaPD6SrY6QZ0EQZHpWvd2OH+LQ+hGbyP8xVCEIiATWn0PPyzcw96pV7o3TLX7pSxPOxphsPOIWkB8Ca224FRzgQUo3FEgA2XgArVX09l5jmFMTagdcpfOH0Hba+q1Z+Vt4B7Jy9/QagqgwnzVnYWYyPGaZVJrhhNHk8Rllzfde/zlnoJYYNXCZoX/QPjgtEHtEHjPweJ+GL+o4UH4k23L+267f99wIDAQAB',
      id: 'gpaihfendegmjoffnpngjjhbipbioknd' },
    { locale: 'iso_3166_1_de',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwdQCKsrqWCC4IFMCjEvm5rK7uZQlKGg9JwwjcUm7/A4SRmKMgmjxqo64DpejJylLemQQf0Z/o00d6hqon+QjjfZb5ers+lx9d1RVk3NAjzkBWrLQ64JK9fAfhnABvfaI06tbSfGthLteJyeoP4yDUHy4iElbrZMJM7yohkkyvNfExomlZ0vIqfii6nNKPuPsa5N1gQMUh9pZ+OeRfMCko1QIyEuLwoP94Hv2Ho1hc+t38sKIXDESwaabXc+1Q+qoq/e12jJzEImYcsJnqXp7kUJOA2l7pEun6Kbio5Zqvdj0KdUWhoBh8WlGp6ykhSoHsp2flwhaK7b8HQx+R7oeiQIDAQAB',
      id: 'dgkplhfdbkdogfblcghcfcgfalanhomi' },
    { locale: 'iso_639_1_de',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw6fYL/onqsR2Eqr2lif68RY8/KSB9e0r6rOXlo6qclUckngboamWnQGZnW8LNrN7fyVjUnsK0OCLzRkOEyEm3hOnmUlROYgk2NvSIzrAhq5PA8M2xc9siU00myQ+IOhbVcNDSOxpbrX9w3e6rA9MwrytywGtL58nDWyOcFgMwfkzQHfxVxeu/rkQODkNEgXZl2t9Jd+1eHCSfleuJeNVfb9OaZ1rjVWwETHwk+Y3w2LHcS2JtFXcA7O9QI/w+s4uYGMogZKwrZG7sYZtAftOOERPrSFJDux/MNjVtm8Rpk0ZWFRIUmVWf6PnFbX6UjtJY2qAN0Nsq27TNvVKCpdz5wIDAQAB',
      id: 'eclclcmhpefndfimkgjknaenojpdffjp' },
      { locale: 'iso_639_1_en',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvgtusqSONTB+vdbby05Kt/CRVLD+90WzphIfnG5UVYTfibXJJ9zlR+bvh86fBq0S5jbhC1e46ooDqBxPzYs8xgkbNfnvdccG26SZM+q40n7qr5Pg6y/4RXAhy0KWfLCmANPR2vjTYMfTHIhRE0mNKIhBsXldNakpzEKf/70jGOT9wh1lwXEkDN8yuQy4YbY+HGRsPowG1G1Y6fN7bR/X24vtiuFN4W2YHjNmFCLeu9o/2Qi1Wtc9+ORCQwLPIWGhSTHd/XUeZt5AfIWBKCOy8VlAYbfmw6STYVznoDsHCSXn0kj5cErGzx6V7oC1uNyXNSf2eQyLSohks+TQ1yvz8QIDAQAB',
      id: 'emgmepnebbddgnkhfmhdhmjifkglkamo' },
    { locale: 'iso_639_1_fr',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAx1/9cmzkLNdnqefKfXfJseIA6Js0e1PC2pkCnkXbMIRBCtvvq86LhUDvERrJZ4UD/zd2YNoRUu9nqMTNpj6IZKfXwKtNwMo5yY1B2KmdOQo4MgIIf+uLVOTc18ylq0WrmLvcKW2cSvD9jR1nY1IR7eZ8n7MAriMJufckAKMpvI72/ylTYUAT5mg+o9JOghx7mixa2OGn1LC3tPlF6kqdBD06z8XBO+mpF5xlLk9CiCYiTdF1V+GiVniDX8XoJ5+nFWJolw0GVEjckFSlZiYCazUox3M2BlURLxxSjZBm77GjdMVosV5+0n0tPJ/Fjb+NnPmslcjo944DmGgzLQ1nQQIDAQAB',
      id: 'hbejpnagkgeeohiojniljejpdpojmfdp' },
    { locale: 'iso_639_1_ja',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvJFbfap/j/4+DJ4FFY2zZHbm14SxpZIyoRwtCSoNKh9HsO9mt+9blnntHmaLDhZ7ITCCux8xy8pQZ/7ztsfm+DplzpDBIasS2T1FsE8VXBE/vL2xzlvo+FTXmgHg+3H6GW/0r7bzGuYml9fZv1aHBGTeajBH7LebLMYV6qlSL3K/iuiHEh+Qq95dqUKcrY28CPPriUzpyLWpQQKV0M3Z5++o04rf0jbOswHN8LSSG3HYB1BzxhPhaEco1Pn3fuxNVM69GXr5huQm8fWxViQHFcWWCd/emRC7MAPHBLuUy5i1QvIjfzfa2DZqwl03hw6m/NzzGIGMYXU3SniystOC4QIDAQAB',
      id: 'ncnmgkcadooabjhgjlkkdipdnfokpjnm' },
    { locale: 'iso_639_1_pt',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtZsD7mfrycGNo2orydis1b/tBCCuPzZdW5TjIgsridYH+hi9C4YkYgvfQ3WNFZHUnvQEsYhOSKr7hhDfGJB8kuZrPMnLnAX6ADjvPQSPPwYhbyBgpkmkVRi649oupVfuqEgJxFAJST7H/vLEMJA+gDHjxxyh+7J/EQbMNho+MgG+aGcQDvCDmax+g3+MXh97r0B/1mrOyskF4zP0q+zclcJVOsefgRGr+h0DbTHtMLWrrvbBO3rsM+7TaX5QTyYm5XgWI7Zt4VoiAzdS3YQCpQf5Simj1yFVFC0TfI8+LXuElBT72bADfRfLh/pVmcx1h2Uv7uK/9eYTVxmbmKxRcQIDAQAB',
      id: 'ikpplkdenofcphgejneekjmhepajgopf' },
    { locale: 'iso_639_1_es',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAonX2Nny33Q7yAmw8OIuaofnbejVaueiBA+lOqTCaMtxB4JcKa5G/FIzs7OQJiIkY7OiPAT7GvaitJP3IUAJNMRZ3O00ZvG7Gg7hkzrQLRk6920d2U/muw0DiY122JUdzadawm67C5WPznzNgOUxSmejkKcvv7Sj9AXf0wbjAd0BSfdPJKOsbtI4A9HAy9Hi88vMTvni/dic3VHnwo6tttz84yUgWEyweT3YKjrdsokJwmJZTV3Bi+o0ZeNOQigPBg0KFwxUCUWA82ZIJ4C/FyE8oZQ0gGE1LPnFw5pXVWfxlGqxGYr5hiPUZFDBIlpTye2utwrjsY3erjJ3zy93HUwIDAQAB',
      id: 'ahiocclicnhmiobhocikfdamfccbehhn' },
    { locale: 'iso_639_1_ar',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA6z+dCLvbhHdl5pwuqPFAh72RfVeq1d73hrOdsD/+d01akpRwvupsYVDlzN3yC0RSr93UrUuvuXoq6dxq+SVprzhzC8ZstHp3qOkA9tF/ln0V8VovRJqdZzMQA4zVQmhC5JtlGfVe9uSh8lp7OaGwmLieu21j8tlqz+dJQCjBEb/yAp0rlU8VDUs8CtLfv6p5ZT6bKR6iBbo5BLRO+ptfHWuVqvfgyIM+TqGfNN077a60p7NwKgLKumh1RMwwPgc+7R70DkWK/a5AfdK0AwBSXBRL4Yq3VZh5DlH3cIdrO1G0boJ5hEVtqu740KJpt2tezbsMimXbREwQFOI/ediW0QIDAQAB',
      id: 'hfiknbegiiiigegdgpcgekhdlpdmladb' },
    { locale: 'iso_639_1_zh',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmfUsqpiVPaGx1vwWmCZJYnf61Db5HTT67twW62Iwk8Z7e6KFcbJhAbphZo6okR4DsaoGp79ioV4Gcj8lGRZ0pYMSZO8cJNoSCYnC8fzNg3JpWX04fW/HXAXGoZcI5mTT6cS8Ip8SWAvbLSC8UqhxX8a8ATRTwSTZO3Wl7WYvR2LQLAndDdFSSI8XhJsARdR0QxDKv8mxyT4Q9t/mo5HJ8LVQwwYqqo5g8zHIAqPVQ0ldxrpLCNnU90t7AEdaLGfqG9gBoRQQ0yf9oQtowoTR4DdRNkdh/ERFtTnANYV1dWicnp+DtTGXcNgsE/yK3mVvblOCKySi+Km0Tn4ZpLEq3QIDAQAB',
      id: 'oblfikajhadjnmjiihdchdfdcfehlbpj' },
    { locale: 'iso_639_1_nl',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwuyw7uEhryLMlXraRHSLu8yGSZYr9wAyrbLoEf97alu959jAvNLOvmI3GXMzb9Qw1mujfTgokaVsjtUYKJwED+fEODk5cUt19oNwPzBGPGIp/UjlGFejJtSD8RO1EErj+0ZQRFBYs/u4kbqIm+1kQ6ITQhthdKfORzVxYIMwXZA1ikioRf1OtHVvWQ+QU9fTMpTlnf8JXW5P1ngzLYCak4+3Ta2BxUayCr4N6/9lQN5frHQOctx04Q7F69YIbV/ua3wCxuYBJUhVMG4pKviMg4knaHOx6KPe4NveYe4z0gnRGRGbi0NKGg28mgBdJdwrwVNQ9T8Pza8Gy+uNk5MLiQIDAQAB',
      id: 'opoleacilplnkhobipjcihpdoklpnjkk' },
    { locale: 'iso_639_1_fi',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwkDWIBN0RdJQIuJQ23HNc+cF9L9gAne+wZuCY2ceyN1OTEy6NS9MqjeFTleOmUpf2aVkQNy6CDbKh5+1nVuukBqo6J2EzXkgs9oTzE2ylXoSPRmxZiFwnphdpQTMGK/fBNGAdjkq7Vx1q3gTXifUmOfU2BAbk0tks25Cj/MwsjjaI4mI6+XsEvvt8SXY3X8xksqmjJvOsLs+glgKKnbzErwPxq9Hv88d9tvPS8kpoihQ5DKJ1pIbNPO+HMaZgTAf/+1Kk1jVsjl7n6iEvXFtfTWEPOQF7VMepomlWAiT2MTIYNQo9zixfrp2hF1UHZx2q8WYuhlXfUfkd4A87W1j4QIDAQAB',
      id: 'djokgcimofealcnfijnlfdnfajpdjcfg' },
    { locale: 'iso_639_1_el',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApAiAA2oeCATGYZo2O8kjwJ2dcVS6a6iBQ+dNQofT9I+12WcIxqbF6A3y9Gja/7RWqak18v39oiruYfhXT/oD81FT0PlNPbDcnV8zry2llVUrLa1yoCd3yxGNmIcaLYOHRUiunJ+dVXEx4MEU9IrKnEGQ/e/R7VukXNxPKJGXv7sawCz5FyQjSYr3fmL5qISiF9vgXKAf4WyXGD2+pWZAvUnT9JUcE2Fd7gT4WcCK4grwUlhSACn+juoGEoEtUmNRzpO3DFQe6XLepS2zrHOam+FovzAcu0D7bP67VDpn/wUU4GbWuVxbLgqZWVM+FzFPObP87iNBp2dYVu1ISwh6IQIDAQAB',
      id: 'aefhgfnampgebnpchhfkaoaiijpmhcca' },
    { locale: 'iso_639_1_he',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsVJ++kpL8skJFkCNMUhLi0ZlaeGFzXdec8RjkTY5mILEBMRmKAjYXgvCjTMoU12dqtlYaRr9FeCIVgIo9ohRQn4Mzm6uQGYzUq3HaW1wvV9PtMQVIoMGarQMjef8Ywcb6+yrLvo5yc6c+apQAiW+UD8mnVhQkQ4PcsSD10mxR6KQ+BtKUDefnZWONTzeDLY5zKDLZLmdx9hr6ivzeZoC5FyV/aXimflIOTJzkuPetehx/gaovsnqAoY8g4J7Cm5kRQJeE424ZPdNU9KggeqPMg6I1Ju1KcfRUlU9a89UZbR58vvmeoSHA8wLK53JVvJ9lz9vjCwfrzrnqHEAAhoPOwIDAQAB',
      id: 'gffjpkbdngpbfkflpnoodjfkpelbappk' },
    { locale: 'iso_639_1_hi',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxNxV7uJTcsXt2kbB7CXOGAiA18LxVM5NJAEN5j4Rn95NxIgV4CvRzH0SUN6HUeSU6C1v/QOZglumDbUVHMUE8z5IKF8kvUuacliX2Km26FT5tHWZiyYWJJb7ioJmFFltV6sxvvkXjSyOeHin2/qXihAvwdxK5XCeW+54ewTh2uMSf+Vd28NyoijwfMF4EP5liAtFhogaslq2gEDR3b2ppZMW8Vt3+rvxr2chncKcuzlcYBedaRKp4rmbYc77+AgWEiAKk0hM4c6fR6/LqM4eLVio/h7HXeZS8kDIJpjMBv8eBky4IfU3r2u5Jjp81wEsaCB7RLuX5tTvrK8y3NnrLQIDAQAB',
      id: 'emhbebmifclalgbdpodobmckfehlkhfp' },
    { locale: 'iso_639_1_it',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvE1PSKf63DKEactzc2nxv4OjxMTBnjalsb2SxsbekwsRKiLfmEjryw6veyZE1Gut03mGsORehQfGdZmML+B5cFRwNEAVWD/4DTqxWzWszjfZR2YjxX+MNsxtwKUuMAo7jZ4R14fOOR/fzeBr+W2aJqgfr25gx7xRwvGOwaacj0T9fsHxR1fngp08wmbSdCYKqVS/KTMwkRcqzWdG3ITB8tl3qz4mP873wXMbq0X5I9Qi5klyDGnehckuZKg2HEPkDxRI4RiJZ/gQpU1dsAdfqNiCYrzSTyMoJBz6cfypPhWzUD4FO4ZPU3KpBzcI8AUOvlAhX28jmSdEIcT5Iwon3QIDAQAB',
      id: 'ijaiihoedhaocihjjkfjnhfhbceekdkg' },
    { locale: 'iso_639_1_ko',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuuV5Wt3NQQ/UPSxzI3LA4gf4DXS/tBfv7CaqzxQ8hPS/AdrqBh0hlQ6spezX8tqUluEKGTEH19jZo4ZHqN3LuP+Cwrc/EL2mx2GLqBwY1tnG+UK2ue2ldVO0S2ls9xc2T6TMegk0s3EAv+syP4p9teqwyKAA9BpN6rKGLGnDfyBKlH7xbMuZ7YnTRDDO84pwiBSXF2TUhMdrV69VYJnrDUtgev+zeGN5paecgnUFi/LdKQpYK2oDF9NeF3Zsrth2ZEjoycKfoMMyGWyi7egd7SGg3lJ0nnjL6YW4dCaHTEdDjmLPK3gqaV5AqU+S6K1UMF2+vmDDihQeXXqDb+8OcwIDAQAB',
      id: 'jbhiacghlejpbieldkdfkgenhnolndlf' },
    { locale: 'iso_639_1_pl',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqsq5PBHdTBkvm5Gae/Mde90jzz5Ihs2fIEQjV7Ee/k4sYKaKg9TTLPCC3q7cUgAqsMVXrNLqlt3W6L2x6dN78HTWv2qvd29+RuhxplOoYnlqz6cJGNtsVhBzwx2v/EyxxCNXMRAEu8UOWePeV28xfW1xDKYnD5G7ZkvRHr15AjYl0R6wqjZPSp6SzHkZ3giFREAUDinvuQFIOFQRfQRz0DWgQm33Lu/lfPmLrrgC7KBCjx1Y5psXAhi1nnzRihE0jaz2N7DNQPKH9XvQlCI+mWnaKVLhKxGYzgHJWlXAXVR+zOo2QWU1kaZ3EcX9VMgBcPRd/Mq9CCpLZfx3Ko6OsQIDAQAB',
      id: 'aijecnhpjljblhnogamehknbmljlbfgn' },
    { locale: 'iso_639_1_ro',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuo2GL8YUL9ZDpJbzDohxMBHXOz7Mb54LSWLlMfn9PjfQXCMFUxxtbCMiEHx0Mu7L6C91uOq4AQAg1dc1sVcQSvOyPu+4jTXLmgjoCo3/8C2xNebnG/PnQxiV2EsC+U+9KZr+OatvLadPf8QwPovY43mZspW+sQ2oqJWmx3nDXAaJ5siyYDB3SEl95ZL6ZG5oZV+8cu94XX2OLXPcv/YWh+n7OfSZSkEuTw6vzivJlNJESq/QDBpnyDM03xrnHuV9oZtwK6J7qm3KQHEJoa3x5THMOWDH0aTWj1bJ5YkPzua5px5IZuWyGoOX1N1zyFa3hPOo0DgKm67tNkufkaoQBQIDAQAB',
      id: 'hffipkehifobjlkdjagndofmpjnpkgje' },
    { locale: 'iso_639_1_ru',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyFHH17BmNBAOAxjsNFUJ3tkWoEI9Z0r8wBbClOvEWNO2+yynTn7uNiMPKtHcghGn46gzVUaUkm4KzbYKmIe0ksYug5XfNfANS2Qglz5WeOB0HRsFwVBaohLmAlEKWjXq9bCpC45RyPyPCzMmBkksv6nesLzh0roDMob56s4XftujS/foCnAEba2Z+XENhTfpb/PCFyE0USAG6LFTcgGylXmL6P5qcZHfbrQCzXVNfJHXsbRH6E3ElI5qlKZbPfUbgbYaZnwu+b3bTY1NJPahH9qkmrWWGMn7Ffi8jzI6F1agEPv4Z+YgM59YFhh1IAe0Ric11GwoMH7UWkWU+y2zGwIDAQAB',
      id: 'nigmjcnboijpcoikglccmoncigioojpa' },
    { locale: 'iso_639_1_sv',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1wKdbZINz3JWjoC7nj80MJPI3zKkxg2w4o3pfHVqR9wu4BcZ93GYwQiXIK1Wnt51mUamRJqLyiCi/7LyGoUyOTxCojKdi4D/2GfH43jZQ6LB4ye6IZpf+RVpVGeLscczY0bjJCw5/QRMmL93HKoauw9CVVI0DVu4Q0UQc5W2liMDsBqmtb2ColE00OmLJMinLC8Ofc9bwzG6AzIeyCDBleupSVGoBe12+ZWsCRtPMhjTUnCP0OtCA97vUUd86kL8AAvWjtgHszhy4dnvzLvhzzr0cMbu5fQSNkJAP74VBh7BOMd0A+621lNtlxthKZ5D17LUJiPRAbTxaqu1sbAgQIDAQAB',
      id: 'jpgndiehmchkacbfggdgkoohioocdhbp' },
    { locale: 'iso_639_1_tl',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApsOnEz3t4hSgmFZrsirg0EZJr5NWP7k5rbcqUZRFhm/xb09/+iBNpnM6TRxqfJNKDYKjlM6glAlD/fVGq4fQcW1Yj3f5Bbo2S00NHJxi2lWEDKm2I7+F48zDAMQE9mOATJMjv2vM1+qRmWaCMEAMk8z1FAr1FyNJwYq6SeZ9/iB9YI8a4pbGsimjY2V0gKBfOZiQRgn49bTs3F9iFcd+lwiDccrYUYPxVdWq3S+3brWNlDukt8hIG5kvIYrQcG3ovgK6hWywIUqswIgpjVxLbnfI150iZ/cmkWfaGbw6Ghuh1QmOP/6EeshQnB9Jm6gw7Zi0IYKkmVtoJ1zcoA3H4wIDAQAB',
      id: 'kcoilhabhhnfdakenmhddnhngngggcmp' },
    { locale: 'iso_639_1_tr',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2zgQlQjqC1r4oykLjVE9LmN8U32KNTNp6M8LpcKA7abk+fBUOUeUebwANxupxw7AxUkoESyT5LBdVNl9Ncnmj1YF9mWB24i52+7qhDaYR9R3Bf13XMNf7J9FLQtabxCvvGv8l0CQV4+DvIiGDH0fPDTWbG5TnZfXlMUC2iUPaNfh9DnFubu37pkT4Q9NmSsy+B4OBZ1aaIS9q8dQ7QDJ2UuXVZcZHk0WEU2H/zEzyGCgRaTZFiTX1dfq919GEoLOQNPqdDE60dRBnAU4twT4uVIyLMftY8pkmd8A596AAWuxJdr0fxFu8EaHdlZtYJLI17irgvR5DlPITlzRyFvzKwIDAQAB',
      id: 'kpdcfihnokkbialolpedfamclbdlgopi' }
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
     description: 'Brave User Model Installer Component',
     key: componentData.key,
     manifest_version: 2,
     name: 'Brave User Model Installer',
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

 const generateCRXFile = (binary, endpoint, region, keyDir, componentData) => {
   const originalManifest = getOriginalManifest(componentData.locale)
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
     util.generateCRXFile(binary, crxFile, privateKeyFile, stagingDir)
     console.log(`Generated ${crxFile} with version number ${version}`)
   })
 }

 util.installErrorHandlers()

 commander
   .option('-b, --binary <binary>', 'Path to the Chromium based executable to use to generate the CRX file')
   .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files')
   .option('-e, --endpoint <endpoint>', 'DynamoDB endpoint to connect to', '')// If setup locally, use http://localhost:8000
   .option('-r, --region <region>', 'The AWS region to use', 'us-west-2')
   .parse(process.argv)

 let keyDir = ''
 if (fs.existsSync(commander.keysDirectory)) {
   keyDir = commander.keysDirectory
 } else {
   throw new Error('Missing or invalid private key directory')
 }

 if (!commander.binary) {
   throw new Error('Missing Chromium binary: --binary')
 }

 util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
   generateManifestFiles()
   getComponentDataList().forEach(generateCRXFile.bind(null, commander.binary, commander.endpoint, commander.region, keyDir))
 })
