-- En los PDF, los enlaces a otros .md apuntan al PDF equivalente (todos están en docs/pdf/).
function Link(el)
  if not el.target:match('^https?:') then
    el.target = el.target:gsub('^.*/', ''):gsub('%.md(#?.*)$', '.pdf%1')
  end
  return el
end
