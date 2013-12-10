exports.fix_key = (key) ->
  a = key.split('/').map (k) ->
    k.split('').map (c) ->
      return '%' + Buffer([c.charCodeAt(0)]).toString('hex') if c[0] in ['.', '$', '[', ']', '#', '/']
      c[0]
    .join('')
  .join('/')
  
  a
